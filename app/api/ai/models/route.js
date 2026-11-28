import { getActiveProviders, getAvailableModels, getJudgeModel } from "@lib/llm";

export const dynamic = "force-dynamic";

// GET /api/ai/models -> which providers are configured and which models the Playground can use
export const GET = async () => {
  return Response.json({
    providers: getActiveProviders(),
    demo: getActiveProviders()[0] === "mock",
    judge: getJudgeModel(),
    models: getAvailableModels(),
  });
};
