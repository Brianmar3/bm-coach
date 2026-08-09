import { exerciseLibraryFacets, exerciseLibrarySummaries } from "@/lib/exercise-library";
import { exerciseMediaAvailable, loadExerciseLibrary } from "@/lib/exercise-library-server";

export const runtime = "nodejs";
export async function GET() {
  const library = await loadExerciseLibrary();
  return Response.json({
    total: library.length,
    items: exerciseLibrarySummaries(library),
    facets: exerciseLibraryFacets(library),
    mediaEnabled: await exerciseMediaAvailable(),
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
