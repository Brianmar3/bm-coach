import { exerciseLibraryFacets, exerciseLibrarySummaries } from "@/lib/exercise-library";
import { exerciseMediaEnabled, loadExerciseLibrary } from "@/lib/exercise-library-server";

export const runtime = "nodejs";
export async function GET() {
  const library = await loadExerciseLibrary();
  return Response.json({
    total: library.length,
    items: exerciseLibrarySummaries(library),
    facets: exerciseLibraryFacets(library),
    mediaEnabled: exerciseMediaEnabled(),
  }, { headers: { "Cache-Control": "public, max-age=300" } });
}
