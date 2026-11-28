import { isValidObjectId } from "mongoose";

import Prompt from "@models/prompts";
import { connectToDB } from "@utils/database";
import { getSessionUserId, unauthorized, forbidden } from "@utils/auth";

const notFound = () => new Response("Prompt not found", { status: 404 });

export const GET = async (request, { params }) => {
  const { id } = await params;
  if (!isValidObjectId(id)) return notFound();

  try {
    await connectToDB();
    const prompt = await Prompt.findById(id).populate("creator", "username image");
    if (!prompt) return notFound();
    return Response.json(prompt);
  } catch (error) {
    return new Response("Internal Server Error", { status: 500 });
  }
};

export const PATCH = async (request, { params }) => {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isValidObjectId(id)) return notFound();
  const { prompt, tag } = await request.json();

  try {
    await connectToDB();
    const existingPrompt = await Prompt.findById(id);
    if (!existingPrompt) return notFound();
    if (existingPrompt.creator.toString() !== userId) return forbidden();

    existingPrompt.prompt = prompt;
    existingPrompt.tag = tag.trim().replace(/^#/, "");
    await existingPrompt.save();

    return new Response("Successfully updated the prompt", { status: 200 });
  } catch (error) {
    return new Response("Error updating prompt", { status: 500 });
  }
};

export const DELETE = async (request, { params }) => {
  const userId = await getSessionUserId();
  if (!userId) return unauthorized();

  const { id } = await params;
  if (!isValidObjectId(id)) return notFound();

  try {
    await connectToDB();
    const existingPrompt = await Prompt.findById(id);
    if (!existingPrompt) return notFound();
    if (existingPrompt.creator.toString() !== userId) return forbidden();

    await existingPrompt.deleteOne();
    return new Response("Prompt deleted successfully", { status: 200 });
  } catch (error) {
    return new Response("Error deleting prompt", { status: 500 });
  }
};
