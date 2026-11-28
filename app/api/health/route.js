import mongoose from "mongoose";

import { connectToDB } from "@utils/database";
import { getActiveProviders } from "@lib/llm";

export const dynamic = "force-dynamic";

// GET /api/health -> used by Docker HEALTHCHECK and the hosting platform.
// Always 200 while the server is up; "db" shows whether MongoDB is reachable.
export const GET = async () => {
  let db = "connected";
  try {
    await Promise.race([
      connectToDB(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 3000)),
    ]);
    if (mongoose.connection.readyState !== 1) db = "disconnected";
  } catch {
    db = "unreachable";
  }

  return Response.json({ status: "ok", db, ai: getActiveProviders() });
};
