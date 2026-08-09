import { readFile } from "node:fs/promises";
import { loadExerciseLibrary, resolveExerciseMediaSource } from "@/lib/exercise-library-server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  const kind = url.searchParams.get("kind");
  if (!id || (kind !== "thumbnail" && kind !== "gif")) return Response.json({ error: "Solicitud inválida." }, { status: 400 });
  const exercise = (await loadExerciseLibrary()).find((item) => item.id === id);
  const relative = kind === "thumbnail" ? exercise?.thumbnailPath : exercise?.gifPath;
  if (!relative) return Response.json({ error: "Medio no disponible." }, { status: 404 });
  const source = await resolveExerciseMediaSource(relative);
  if (source.kind === "unavailable") return Response.json({ error: "Medio no disponible." }, { status: 404 });
  try {
    return new Response(await readFile(source.filePath), { headers: { "Content-Type": kind === "gif" ? "image/gif" : relative.endsWith(".png") ? "image/png" : "image/jpeg", "Cache-Control": "private, max-age=3600" } });
  } catch { return Response.json({ error: "Medio no disponible." }, { status: 404 }); }
}
