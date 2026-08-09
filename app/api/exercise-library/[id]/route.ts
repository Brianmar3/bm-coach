import { exerciseMediaEnabled, loadExerciseLibrary } from "@/lib/exercise-library-server";

export const runtime = "nodejs";
export async function GET(_request: Request, context: RouteContext<"/api/exercise-library/[id]">) {
  const { id } = await context.params;
  const exercise = (await loadExerciseLibrary()).find((item) => item.id === decodeURIComponent(id));
  return exercise ? Response.json({ exercise, mediaEnabled: exerciseMediaEnabled() }) : Response.json({ error: "Ejercicio no encontrado." }, { status: 404 });
}
