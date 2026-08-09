import { readFile } from "node:fs/promises";
import { datasetMediaPath, exerciseMediaEnabled, loadExerciseLibrary } from "@/lib/exercise-library-server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!exerciseMediaEnabled()) return Response.json({ error: "Los medios de ejercicios están deshabilitados." }, { status: 404 });
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const kind = url.searchParams.get("kind");
  if (!id || (kind !== "thumbnail" && kind !== "gif")) return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  const exercise = (await loadExerciseLibrary()).find((item) => item.id === id);
  const relative = kind === "thumbnail" ? exercise?.thumbnailPath : exercise?.gifPath;
  const filePath = relative ? datasetMediaPath(relative) : null;
  if (!filePath) return Response.json({ error: "Medio no encontrado." }, { status: 404 });
  try {
    return new Response(await readFile(filePath), { headers: { "Content-Type": kind === "gif" ? "image/gif" : relative?.endsWith(".png") ? "image/png" : "image/jpeg", "Cache-Control": "private, max-age=3600" } });
  } catch { return Response.json({ error: "Medio no disponible." }, { status: 404 }); }
}
