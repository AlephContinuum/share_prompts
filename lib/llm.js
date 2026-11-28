/**
 * One small interface over several LLM providers.
 *
 *   generate({ model, system, prompt, maxTokens }) -> { text, inputTokens, outputTokens, ms }
 *
 * Provider is chosen with LLM_PROVIDER:
 *   - "bedrock": Amazon Bedrock Converse API (one API for Nova, Claude, Llama, Mistral...)
 *   - "gemini":  Google Gemini API (has a free tier, handy for local development)
 *   - "mock":    fake answers, so the UI can be developed and demoed without any key
 * If LLM_PROVIDER is not set, the first provider with credentials configured is used.
 *
 * All calls happen on the server. API keys never reach the browser.
 */
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const list = (value, fallback) =>
  (value || fallback).split(",").map((s) => s.trim()).filter(Boolean);

const PROVIDERS = {
  bedrock: {
    label: "Amazon Bedrock",
    configured: () => Boolean(process.env.BEDROCK_REGION || process.env.BEDROCK_ACCESS_KEY_ID),
    models: () =>
      list(process.env.BEDROCK_MODELS, "amazon.nova-micro-v1:0,amazon.nova-lite-v1:0,amazon.nova-pro-v1:0"),
    judgeModel: () => process.env.BEDROCK_JUDGE_MODEL || "amazon.nova-pro-v1:0",
    utilityModel: () => process.env.BEDROCK_UTILITY_MODEL || "amazon.nova-lite-v1:0",
    generate: bedrockGenerate,
  },
  gemini: {
    label: "Google Gemini",
    configured: () => Boolean(process.env.GEMINI_API_KEY),
    models: () => list(process.env.GEMINI_MODELS, "gemini-2.5-flash-lite,gemini-2.5-flash"),
    judgeModel: () => process.env.GEMINI_JUDGE_MODEL || "gemini-2.5-flash",
    utilityModel: () => process.env.GEMINI_UTILITY_MODEL || "gemini-2.5-flash-lite",
    generate: geminiGenerate,
  },
  mock: {
    label: "Demo mode (no AI key configured)",
    configured: () => true,
    models: () => ["mock-concise", "mock-detailed"],
    judgeModel: () => "mock-judge",
    utilityModel: () => "mock-utility",
    generate: mockGenerate,
  },
};

export const getProvider = () => {
  const forced = process.env.LLM_PROVIDER;
  if (forced && PROVIDERS[forced]) return { id: forced, ...PROVIDERS[forced] };
  const id = ["bedrock", "gemini"].find((p) => PROVIDERS[p].configured()) ?? "mock";
  return { id, ...PROVIDERS[id] };
};

export const generate = async ({ model, system, prompt, maxTokens = 600, temperature = 0.7 }) => {
  const provider = getProvider();
  const start = Date.now();
  const result = await provider.generate({ model, system, prompt, maxTokens, temperature });
  return { ...result, ms: Date.now() - start };
};

// ---------- Amazon Bedrock ----------

let bedrockClient;
const getBedrockClient = () => {
  if (!bedrockClient) {
    // On AWS (Amplify compute role, Lambda, EC2) credentials come from the attached IAM role.
    // Locally, or where AWS_* names are reserved (Amplify env vars), use BEDROCK_* keys instead.
    const credentials = process.env.BEDROCK_ACCESS_KEY_ID
      ? {
          accessKeyId: process.env.BEDROCK_ACCESS_KEY_ID,
          secretAccessKey: process.env.BEDROCK_SECRET_ACCESS_KEY,
        }
      : undefined;
    bedrockClient = new BedrockRuntimeClient({
      region: process.env.BEDROCK_REGION || "us-east-1",
      credentials,
    });
  }
  return bedrockClient;
};

async function bedrockGenerate({ model, system, prompt, maxTokens, temperature }) {
  const response = await getBedrockClient().send(
    new ConverseCommand({
      modelId: model,
      system: system ? [{ text: system }] : undefined,
      messages: [{ role: "user", content: [{ text: prompt }] }],
      inferenceConfig: { maxTokens, temperature },
    })
  );
  const text = response.output?.message?.content?.map((c) => c.text ?? "").join("") ?? "";
  return {
    text,
    inputTokens: response.usage?.inputTokens ?? null,
    outputTokens: response.usage?.outputTokens ?? null,
  };
}

// ---------- Google Gemini ----------

async function geminiGenerate({ model, system, prompt, maxTokens, temperature }) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
    }
  );
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return {
    text,
    inputTokens: data.usageMetadata?.promptTokenCount ?? null,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
  };
}

// ---------- Mock (no key needed) ----------

async function mockGenerate({ model, prompt }) {
  await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
  const preview = prompt.replace(/\s+/g, " ").slice(0, 120);

  if (model === "mock-utility") {
    return {
      text: JSON.stringify({
        tags: ["writing", "productivity", "ideas"],
        improved: `You are an expert assistant. ${prompt.trim()}\n\nRespond in clear, numbered steps and keep it under 200 words.`,
        reason: "Added a role, an output format and a length limit (demo mode).",
      }),
      inputTokens: 0,
      outputTokens: 0,
    };
  }
  if (model === "mock-judge") {
    return {
      text: JSON.stringify({
        winner: "mock-detailed",
        summary: "Demo mode: configure Bedrock or Gemini to get a real comparison.",
        best_answer: "This is where the synthesized best answer will appear.",
      }),
      inputTokens: 0,
      outputTokens: 0,
    };
  }
  const text =
    model === "mock-concise"
      ? `(demo) Short answer to: "${preview}"`
      : `(demo) A longer, step-by-step answer to: "${preview}"\n\n1. First point\n2. Second point\n3. Third point`;
  return { text, inputTokens: null, outputTokens: null };
}

/** Pull the first JSON object out of a model reply (models sometimes wrap it in ```json fences). */
export const parseJsonReply = (text) => {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Model did not return JSON");
  return JSON.parse(match[0]);
};
