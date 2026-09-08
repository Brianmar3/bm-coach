import { loadExerciseLibrary } from "@/lib/exercise-library-server";
import { requireSelfServiceAccount } from "@/lib/self-service-account";
import { generateSelfServiceRoutineProposal } from "@/lib/self-service-routine-proposal";
import { validSelfServiceRoutineAnswers } from "@/lib/self-service-routine-persistence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await requireSelfServiceAccount();
  const input = await request.json().catch(() => null);
  if (!validSelfServiceRoutineAnswers(input)) return Response.json({ error: "Revisá los datos de tu rutina." }, { status: 400 });
  try {
    return Response.json(generateSelfServiceRoutineProposal(input, await loadExerciseLibrary()));
  } catch (error) {
    console.error("No se pudo generar la propuesta SELF_SERVICE", error instanceof Error ? error.message : "Error desconocido");
    return Response.json({ error: "No pudimos generar la propuesta. Intentá nuevamente." }, { status: 500 });
  }
}
