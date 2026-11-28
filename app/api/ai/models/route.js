import { getProvider } from "@lib/llm";

export const dynamic = "force-dynamic";

// GET /api/ai/models -> which provider is active and which models the playground can use
export const GET = async () => {
  const provider = getProvider();
  return Response.json({ provider: provider.id, label: provider.label, models: provider.models() });
};
