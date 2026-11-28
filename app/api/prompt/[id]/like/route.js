import { isValidObjectId } from "mongoose";

import Prompt from "@models/prompts";
import { connectToDB } from "@utils/database";
import { getSessionUserId, unauthorized } from "@utils/auth";

// POST /api/prompt/:id/like  -> toggles the current user's like
export const POST = async (request, { params }) => {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isValidObjectId(id)) return new Response("Prompt not found", { status: 404 });

  try {
    await connectToDB();
    const prompt = await Prompt.findById(id).select("likes");
    if (!prompt) return new Response("Prompt not found", { status: 404 });

    const alreadyLiked = prompt.likes.some((u) => u.toString() === userId);
    // $addToSet / $pull are atomic, so two quick clicks can't double-count.
    const updated = await Prompt.findByIdAndUpdate(
      id,
      alreadyLiked ? { $pull: { likes: userId } } : { $addToSet: { likes: userId } },
      { new: true }
    ).select("likes");

    return Response.json({ liked: !alreadyLiked, likes: updated.likes.length });
  } catch (error) {
    return new Response("Failed to update like", { status: 500 });
  }
};
