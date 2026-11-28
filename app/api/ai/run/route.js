import { isValidObjectId } from "mongoose";

import Prompt from "@models/prompts";
import { connectToDB } from "@utils/database";
import { getSessionUserId, unauthorized } from "@utils/auth";
import { generate, getProvider, parseJsonReply } from "@lib/llm";
import { rateLimit } from "@lib/rateLimit";

const MAX_PROMPT = 4000;
const MAX_MODELS = 4;

const JUDGE_SYSTEM = `You compare answers that different AI models gave to the same prompt.
Judge them on correctness, completeness, clarity and how well they follow the prompt.
Reply with ONLY a JSON object, no other text:
{"winner": "<model id of the best answer>", "summary": "<2-3 sentences: why it won and what the others missed>", "best_answer": "<one improved answer that combines the strongest parts of all answers>"}`;

/**
 * POST /api/ai/run
 * body: { prompt, models: string[], judge?: boolean, promptId?: string }
 * Runs the prompt on every selected model in parallel, then (optionally) asks a judge
 * model to compare the answers and write a combined best answer.
 */
export const POST = async (req) => {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const limit = rateLimit(`run:${userId}`, { limit: 15 });
  if (!limit.ok) {
    return new Response(`Too many runs. Try again in ${limit.retryAfterSec}s.`, { status: 429 });
  }

  const { prompt, models, judge = false, promptId } = await req.json();
  if (!prompt?.trim()) return new Response("Prompt is required", { status: 400 });
  if (prompt.length > MAX_PROMPT) {
    return new Response(`Prompt must be ${MAX_PROMPT} characters or fewer`, { status: 400 });
  }

  // Only allow models from the configured list, so the browser can't pick an expensive one.
  const provider = getProvider();
  const allowed = provider.models();
  const selected = (Array.isArray(models) ? models : []).filter((m) => allowed.includes(m));
  if (selected.length === 0) return new Response("Pick at least one model", { status: 400 });
  if (selected.length > MAX_MODELS) {
    return new Response(`Pick at most ${MAX_MODELS} models`, { status: 400 });
  }

  // Layer 1: every model answers independently, in parallel. One failure doesn't sink the rest.
  const settled = await Promise.allSettled(selected.map((model) => generate({ model, prompt })));
  const results = settled.map((s, i) =>
    s.status === "fulfilled"
      ? { model: selected[i], ok: true, ...s.value }
      : { model: selected[i], ok: false, error: s.reason?.message ?? "Model call failed" }
  );

  // Layer 2: a judge model compares the successful answers.
  let verdict = null;
  const answered = results.filter((r) => r.ok && r.text);
  if (judge && answered.length >= 2) {
    const judgeInput =
      `PROMPT:\n${prompt}\n\n` +
      answered.map((r) => `--- ANSWER FROM ${r.model} ---\n${r.text}`).join("\n\n");
    try {
      const out = await generate({
        model: provider.judgeModel(),
        system: JUDGE_SYSTEM,
        prompt: judgeInput,
        maxTokens: 900,
        temperature: 0.2,
      });
      verdict = { model: provider.judgeModel(), ms: out.ms, ...parseJsonReply(out.text) };
    } catch (error) {
      verdict = { error: `Judge failed: ${error.message}` };
    }
  }

  if (promptId && isValidObjectId(promptId)) {
    try {
      await connectToDB();
      await Prompt.updateOne({ _id: promptId }, { $inc: { runCount: 1 } });
    } catch (error) {
      console.error("runCount update failed:", error); // not fatal for the user
    }
  }

  return Response.json({ provider: provider.id, results, verdict });
};
