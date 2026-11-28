import Prompt from "@models/prompts";
import { connectToDB } from "@utils/database";
import { getSessionUserId, unauthorized } from "@utils/auth";

export const POST = async (req) => {
  // The creator comes from the server-side session, never from the request body.
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { prompt, tag } = await req.json();
  if (!prompt?.trim() || !tag?.trim()) {
    return new Response("Prompt and tag are required", { status: 400 });
  }

  try {
    await connectToDB();
    const newPrompt = await Prompt.create({
      creator: userId,
      prompt: prompt.trim(),
      tag: tag.trim().replace(/^#/, ""),
    });
    return Response.json(newPrompt, { status: 201 });
  } catch (error) {
    console.error("Create prompt error:", error);
    return new Response("Failed to create prompt", { status: 500 });
  }
};
