/**
 * One small interface over several LLM providers.
 *
 *   generate({ model, system, prompt, maxTokens }) -> { text, inputTokens, outputTokens, ms }
 *
 * A model id is "<provider>:<model>", e.g. "gemini:gemini-2.5-flash" or "openai:gpt-4.1-mini".
 * Every provider that has credentials in the environment is enabled at the same time,
 * so the Playground can compare models from different companies side by side.
 *
 *   - bedrock:  Amazon Bedrock Converse API (Nova, Claude, Llama, Mistral... behind one API)
 *   - gemini:   Google Gemini API (free tier, good for development)
 *   - groq:     Groq (very fast open models, free tier, OpenAI-compatible)
 *   - nvidia:   NVIDIA API catalog (Nemotron and other open models, OpenAI-compatible)
 *   - verda:    Verda inference (Kimi K3.1 Pro, OpenAI-compatible)
 *   - openai:   OpenAI Chat Completions API
 *   - deepseek: DeepSeek API (OpenAI-compatible)
 *   - mock:     fake answers, used only when no provider is configured
 *
 * All calls happen on the server. API keys never reach the browser.
 */
import { BedrockRuntimeClient, ConverseCommand } from "@aws-sdk/client-bedrock-runtime";

const list = (value, fallback) =>
  (value || fallback).split(",").map((s) => s.trim()).filter(Boolean);

const PROVIDERS = {
  bedrock: {
    label: "Amazon Bedrock",
    // On with access keys (local dev) or BEDROCK_ENABLED=true (server with an IAM role)
    configured: () =>
      process.env.BEDROCK_ENABLED === "true" || Boolean(process.env.BEDROCK_ACCESS_KEY_ID),
    models: () => list(process.env.BEDROCK_MODELS, "amazon.nova-micro-v1:0,amazon.nova-lite-v1:0,amazon.nova-pro-v1:0"),
    judgeModel: "amazon.nova-pro-v1:0",
    utilityModel: "amazon.nova-lite-v1:0",
    generate: bedrockGenerate,
  },
  groq: {
    label: "Groq",
    configured: () => Boolean(process.env.GROQ_API_KEY),
    models: () => list(process.env.GROQ_MODELS, "openai/gpt-oss-120b,qwen/qwen3.8-27b"),
    judgeModel: "openai/gpt-oss-120b",
    utilityModel: "openai/gpt-oss-20b",
    generate: (opts) =>
      openAICompatibleGenerate({
        ...opts,
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: process.env.GROQ_API_KEY,
        tokenParam: "max_tokens",
        name: "Groq",
        // gpt-oss models reason before answering; "low" keeps them fast
        extra: (model) => (model.startsWith("openai/gpt-oss") ? { reasoning_effort: "low" } : {}),
      }),
  },
  gemini: {
    label: "Google Gemini",
    configured: () => Boolean(process.env.GEMINI_API_KEY),
    models: () => list(process.env.GEMINI_MODELS, "gemini-3-flash-preview,gemini-3.1-flash-lite"),
    judgeModel: "gemini-3-flash-preview",
    utilityModel: "gemini-3.1-flash-lite",
    generate: geminiGenerate,
  },
  nvidia: {
    label: "NVIDIA",
    configured: () => Boolean(process.env.NVIDIA_API_KEY),
    models: () =>
      list(process.env.NVIDIA_MODELS, "nvidia/nemotron-3.5-lightning-30b-a3b,minimaxai/minimax-m3.1-flash"),
    judgeModel: "nvidia/nemotron-3.5-lightning-30b-a3b",
    utilityModel: "nvidia/nemotron-3.5-lightning-30b-a3b",
    generate: (opts) =>
      openAICompatibleGenerate({
        ...opts,
        url: "https://integrate.api.nvidia.com/v1/chat/completions",
        apiKey: process.env.NVIDIA_API_KEY,
        tokenParam: "max_tokens",
        name: "NVIDIA",
        // Nemotron "thinks" by default and can spend the whole token budget doing it
        extra: (model) =>
          model.includes("nemotron") ? { chat_template_kwargs: { thinking: false, enable_thinking: false } } : {},
      }),
  },
  verda: {
    label: "Verda",
    configured: () => Boolean(process.env.VERDA_API_KEY),
    models: () => list(process.env.VERDA_MODELS, "kimi-k3-1-pro"),
    judgeModel: "kimi-k3-1-pro",
    utilityModel: "kimi-k3-1-pro",
    generate: (opts) =>
      openAICompatibleGenerate({
        ...opts,
        url: "https://inference.verda.com/v1/chat/completions",
        apiKey: process.env.VERDA_API_KEY,
        tokenParam: "max_tokens",
        name: "Verda",
      }),
  },
  openai: {
    label: "OpenAI",
    configured: () => Boolean(process.env.OPENAI_API_KEY),
    models: () => list(process.env.OPENAI_MODELS, "gpt-4.1-mini,gpt-5.4-mini"),
    judgeModel: "gpt-4.1-mini",
    utilityModel: "gpt-4.1-mini",
    generate: (opts) =>
      openAICompatibleGenerate({
        ...opts,
        url: "https://api.openai.com/v1/chat/completions",
        apiKey: process.env.OPENAI_API_KEY,
        tokenParam: "max_completion_tokens",
        name: "OpenAI",
        // GPT-5 and o-series are reasoning models: they only accept the default temperature
        extra: (model) =>
          /^(gpt-5|gpt-6|o\d)/.test(model) ? { temperature: undefined, reasoning_effort: "low" } : {},
      }),
  },
  deepseek: {
    label: "DeepSeek",
    configured: () => Boolean(process.env.DEEPSEEK_API_KEY),
    models: () => list(process.env.DEEPSEEK_MODELS, "deepseek-flash,deepseek-v4-pro"),
    judgeModel: "deepseek-v4-pro",
    utilityModel: "deepseek-flash",
    generate: (opts) =>
      openAICompatibleGenerate({
        ...opts,
        url: "https://api.deepseek.com/chat/completions",
        apiKey: process.env.DEEPSEEK_API_KEY,
        tokenParam: "max_tokens",
        name: "DeepSeek",
      }),
  },
  mock: {
    label: "Demo mode",
    configured: () => false, // only used as a fallback
    models: () => ["mock-concise", "mock-detailed"],
    judgeModel: "mock-judge",
    utilityModel: "mock-utility",
    generate: mockGenerate,
  },
};

// Bedrock first (the AWS deployment target), then free tiers, then paid providers.
// The first configured provider supplies the default judge and utility models.
const ORDER = ["bedrock", "groq", "gemini", "nvidia", "verda", "openai", "deepseek"];

const TIMEOUT_MS = 45_000; // a slow model shouldn't hold the whole Playground run hostage

/** Providers that have credentials configured (or just mock if none). */
export const getActiveProviders = () => {
  const active = ORDER.filter((id) => PROVIDERS[id].configured());
  return active.length ? active : ["mock"];
};

/** Every model the Playground may use, as [{ id, provider, label, model }]. */
export const getAvailableModels = () =>
  getActiveProviders().flatMap((provider) =>
    PROVIDERS[provider].models().map((model) => ({
      id: `${provider}:${model}`,
      provider,
      label: PROVIDERS[provider].label,
      model,
    }))
  );

const pickRole = (envName, role) => {
  // Any model from a configured provider is fine here, even one not offered in the Playground
  // (e.g. a stronger judge). Overrides for unconfigured providers are ignored.
  const fromEnv = process.env[envName];
  if (fromEnv && getActiveProviders().includes(fromEnv.split(":")[0])) return fromEnv;
  const first = getActiveProviders()[0];
  return `${first}:${PROVIDERS[first][role]}`;
};

/** Model that compares answers. Override with JUDGE_MODEL="provider:model". */
export const getJudgeModel = () => pickRole("JUDGE_MODEL", "judgeModel");

/** Cheap model for prompt suggestions. Override with UTILITY_MODEL="provider:model". */
export const getUtilityModel = () => pickRole("UTILITY_MODEL", "utilityModel");

// 1024 leaves room for reasoning models, which spend some tokens thinking before answering
export const generate = async ({ model, system, prompt, maxTokens = 1024, temperature = 0.7 }) => {
  const split = model.indexOf(":");
  const providerId = model.slice(0, split);
  const provider = PROVIDERS[providerId];
  if (split < 1 || !provider) throw new Error(`Unknown model "${model}"`);

  const start = Date.now();
  const result = await provider.generate({
    model: model.slice(split + 1),
    system,
    prompt,
    maxTokens,
    temperature,
  });
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
    }),
    { abortSignal: AbortSignal.timeout(TIMEOUT_MS) }
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
  const res = await postWithRetry(
    "Gemini",
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { "x-goog-api-key": process.env.GEMINI_API_KEY },
    {
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
        // Gemini 3 models think before answering; keep it short so replies stay fast
        ...(model.startsWith("gemini-3") ? { thinkingConfig: { thinkingLevel: "low" } } : {}),
      },
    }
  );
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text) throw new Error(`Gemini returned no text (${data.candidates?.[0]?.finishReason ?? "unknown reason"})`);
  return {
    text,
    inputTokens: data.usageMetadata?.promptTokenCount ?? null,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
  };
}

// ---------- OpenAI, DeepSeek, Groq, NVIDIA (same Chat Completions format) ----------

async function openAICompatibleGenerate({
  url, apiKey, tokenParam, name, extra, model, system, prompt, maxTokens, temperature,
}) {
  const messages = [
    ...(system ? [{ role: "system", content: system }] : []),
    { role: "user", content: prompt },
  ];
  const body = { model, messages, temperature, [tokenParam]: maxTokens, ...(extra?.(model) ?? {}) };
  for (const key of Object.keys(body)) if (body[key] === undefined) delete body[key];

  const res = await postWithRetry(name, url, { Authorization: `Bearer ${apiKey}` }, body);
  const data = await res.json();
  const choice = data.choices?.[0];
  // Some open models put their reasoning inline as <think>...</think>; keep only the answer
  const text = (choice?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  if (!text) {
    throw new Error(
      choice?.finish_reason === "length"
        ? `${name} used its whole token budget on reasoning and returned no answer`
        : `${name} returned no text (${choice?.finish_reason ?? "unknown reason"})`
    );
  }
  return {
    text,
    inputTokens: data.usage?.prompt_tokens ?? null,
    outputTokens: data.usage?.completion_tokens ?? null,
  };
}

// ---------- Shared HTTP helper ----------

/** POST JSON with a timeout, one retry on "overloaded" errors, and readable error messages. */
async function postWithRetry(name, url, headers, body, attempt = 1) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    if (error.name === "TimeoutError") throw new Error(`${name} took longer than ${TIMEOUT_MS / 1000}s`);
    throw new Error(`${name} could not be reached: ${error.message}`);
  }
  if (res.ok) return res;

  if ((res.status === 503 || res.status === 529) && attempt === 1) {
    await new Promise((r) => setTimeout(r, 1500));
    return postWithRetry(name, url, headers, body, 2);
  }
  const detail = (await res.text()).replace(/\s+/g, " ").slice(0, 200);
  const hint =
    /subscri/i.test(detail) ? "your account isn't subscribed to this model"
    : res.status === 401 || res.status === 403 ? "check the API key"
    : res.status === 402 || /credit|balance|billing|quota/i.test(detail) ? "the account has no credit left"
    : res.status === 404 ? "this model isn't available to your account"
    : res.status === 429 ? "rate limit reached, try again shortly"
    : res.status >= 500 ? "the provider is having problems, try again later"
    : null;
  throw new Error(`${name} error ${res.status}${hint ? ` (${hint})` : ""}: ${detail}`);
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
      inputTokens: null,
      outputTokens: null,
    };
  }
  if (model === "mock-judge") {
    return {
      text: JSON.stringify({
        winner: "B",
        summary: "Answer B is longer than Answer A. Demo mode: add an API key to get a real comparison.",
        best_answer: "This is where the synthesized best answer will appear.",
      }),
      inputTokens: null,
      outputTokens: null,
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
