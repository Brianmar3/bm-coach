import { requireAdminApiResponse } from "@/lib/admin-api-auth";
import { loadExerciseLibrary } from "@/lib/exercise-library-server";
import { buildSuggestedTrainingBlocks } from "@/lib/suggested-training-blocks";

export const runtime = "nodejs";

export async function GET() {
  const unauthorized = await requireAdminApiResponse();
  if (unauthorized) return unauthorized;
  return Response.json(buildSuggestedTrainingBlocks(await loadExerciseLibrary()));
}
