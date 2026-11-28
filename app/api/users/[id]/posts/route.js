import { isValidObjectId } from "mongoose";

import Prompt from "@models/prompts";
import { connectToDB } from "@utils/database";

export const GET = async (request, { params }) => {
  const { id } = await params;
  if (!isValidObjectId(id)) return Response.json([]);

  try {
    await connectToDB();
    const prompts = await Prompt.find({ creator: id }).populate("creator", "username image").sort({ createdAt: -1 });
    return Response.json(prompts);
  } catch (error) {
    return new Response("Failed to fetch prompts created by user", { status: 500 });
  }
};
