import Prompt from "@models/prompts";
import { connectToDB } from "@utils/database";

// Never cache the feed: it changes whenever someone posts or likes.
export const dynamic = "force-dynamic";

// GET /api/prompt?sort=new|popular
export const GET = async (request) => {
  try {
    await connectToDB();

    const sort = new URL(request.url).searchParams.get("sort");
    const prompts = await Prompt.find({}).populate("creator", "username image").lean();

    if (sort === "popular") {
      prompts.sort(
        (a, b) =>
          (b.likes?.length ?? 0) - (a.likes?.length ?? 0) ||
          (b.runCount ?? 0) - (a.runCount ?? 0)
      );
    } else {
      // Newest first. Older prompts without timestamps fall back to the ObjectId time.
      const time = (p) => new Date(p.createdAt ?? p._id.getTimestamp()).getTime();
      prompts.sort((a, b) => time(b) - time(a));
    }

    return Response.json(prompts);
  } catch (error) {
    console.error("Fetch prompts error:", error);
    return new Response("Failed to fetch all prompts", { status: 500 });
  }
};
