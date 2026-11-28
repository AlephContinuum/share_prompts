import { getSessionUserId, unauthorized } from "@utils/auth";
import { generate, getUtilityModel, parseJsonReply } from "@lib/llm";
import { rateLimit } from "@lib/rateLimit";

const SYSTEM = `You are a prompt-engineering assistant.
Given a user's AI prompt, return ONLY a JSON object, no other text:
{"tags": ["<1-3 short lowercase topic tags, no # sign>"], "improved": "<a rewritten version of the prompt that is clearer and more specific: add a role, context, the desired output format and constraints where useful; keep the user's intent>", "reason": "<one sentence on what you changed>"}`;

// POST /api/ai/suggest  body: { prompt } -> { tags, improved, reason }
export const POST = async (req) => {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const limit = rateLimit(`suggest:${userId}`, { limit: 20 });
  if (!limit.ok) {
    return new Response(`Too many requests. Try again in ${limit.retryAfterSec}s.`, { status: 429 });
  }

  const { prompt } = await req.json();
  if (!prompt?.trim() || prompt.length > 4000) {
    return new Response("Prompt must be 1-4000 characters", { status: 400 });
  }

  try {
    const out = await generate({
      model: getUtilityModel(),
      system: SYSTEM,
      prompt,
      maxTokens: 1000,
      temperature: 0.3,
    });
    const data = parseJsonReply(out.text);
    const tags = (Array.isArray(data.tags) ? data.tags : [])
      .map((t) => String(t).toLowerCase().replace(/^#/, "").replace(/\s+/g, "-"))
      .slice(0, 3);
    return Response.json({ tags, improved: String(data.improved ?? ""), reason: String(data.reason ?? "") });
  } catch (error) {
    console.error("Suggest error:", error);
    return new Response("AI suggestion failed, please try again", { status: 502 });
  }
};
