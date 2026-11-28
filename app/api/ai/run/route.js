import { isValidObjectId } from "mongoose";

import Prompt from "@models/prompts";
import { connectToDB } from "@utils/database";
import { getSessionUserId, unauthorized } from "@utils/auth";
import { generate, getAvailableModels, getJudgeModel, parseJsonReply } from "@lib/llm";
import { rateLimit } from "@lib/rateLimit";

const MAX_PROMPT = 4000;
const MAX_MODELS = 4;

const JUDGE_SYSTEM = `You compare anonymous answers (labelled A, B, C...) that different AI models gave to the same prompt.
Judge them on correctness, completeness, clarity and how well they follow the prompt.
Reply with ONLY a JSON object, no other text:
{"winner": "<letter of the best answer>", "summary": "<2-3 sentences: why it won and what the others missed. Always refer to an answer as [A], [B], [C] with square brackets>", "best_answer": "<one improved answer that combines the strongest parts of all answers>"}`;

const LETTERS = "ABCDEFGH";

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
  const judgeModel = getJudgeModel();
  const allowed = getAvailableModels().map((m) => m.id);
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
      // Model names are hidden so the judge can't favour a model it recognises (e.g. itself).
      answered.map((r, i) => `--- ANSWER ${LETTERS[i]} ---\n${r.text}`).join("\n\n");
    try {
      const out = await generate({
        model: judgeModel,
        system: JUDGE_SYSTEM,
        prompt: judgeInput,
        maxTokens: 1500,
        temperature: 0.2,
      });
      const parsed = parseJsonReply(out.text);
      const letter = String(parsed.winner ?? "").trim().toUpperCase().charAt(0);
      const winner = answered[LETTERS.indexOf(letter)]?.model ?? null;
      // Show model names instead of letters in the summary the user reads.
      const shortName = (id) => id.slice(id.indexOf(":") + 1); // "gemini:gemini-2.5-flash" -> "gemini-2.5-flash"
      const nameFor = (l, fallback) => {
        const r = answered[LETTERS.indexOf(l)];
        return r ? shortName(r.model) : fallback;
      };
      // Replace "[A]", "Answer A" / "answer A" and "B's" with model names
      const summary = String(parsed.summary ?? "")
        .replace(/\b[Aa]nswers? (?=\[[A-H]\])/g, "") // "Answer [A]" -> "[A]"
        .replace(/\[([A-H])\]/g, (m, l) => nameFor(l, m))
        .replace(/\b[Aa]nswer ([A-H])\b/g, (m, l) => nameFor(l, m))
        .replace(/\b([A-H])(?='s\b)/g, (m, l) => nameFor(l, m));
      verdict = {
        model: judgeModel,
        ms: out.ms,
        winner,
        summary,
        best_answer: String(parsed.best_answer ?? ""),
      };
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

  return Response.json({ results, verdict });
};
