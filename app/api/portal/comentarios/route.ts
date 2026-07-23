import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CommentInput = {
  context: "sesion" | "ejercicio" | "evaluacion" | "general";
  category: "consulta" | "dificultad" | "dolor" | "devolucion";
  body: string;
  sessionId?: string;
  exerciseId?: string;
  evaluationId?: string;
};

export async function POST(request: Request) {
  try {
    if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
    const session = await getPortalSession();
    if (!session) return Response.json({ error: "Sesión no válida." }, { status: 401 });
    if (session.credential.mustChangePassword) return Response.json({ error: "Debés cambiar tu contraseña temporal." }, { status: 403 });
    const input = await request.json() as CommentInput;
    if (!["sesion", "ejercicio", "evaluacion", "general"].includes(input.context) || !["consulta", "dificultad", "dolor", "devolucion"].includes(input.category)) return Response.json({ error: "Seleccioná un tipo de comentario válido." }, { status: 400 });
    const body = input.body?.trim();
    if (!body || body.length > 2000) return Response.json({ error: "Escribí un mensaje de hasta 2000 caracteres." }, { status: 400 });

    if (input.sessionId && !await prisma.workoutSession.findFirst({ where: { id: input.sessionId, studentId: session.studentId }, select: { id: true } })) return Response.json({ error: "La sesión no te pertenece." }, { status: 403 });
    if (input.evaluationId && !await prisma.physicalEvaluation.findFirst({ where: { id: input.evaluationId, studentId: session.studentId }, select: { id: true } })) return Response.json({ error: "La evaluación no te pertenece." }, { status: 403 });
    if (input.exerciseId && !await prisma.trainingRoutineExercise.findFirst({
      where: {
        id: input.exerciseId,
        active: true,
        day: {
          active: true,
          routine: {
            status: "ACTIVA",
            assignments: { some: { studentId: session.studentId, active: true } },
          },
        },
      },
      select: { id: true },
    })) return Response.json({ error: "El ejercicio no pertenece a tu rutina activa." }, { status: 403 });

    const created = await prisma.followUpComment.create({
      data: {
        studentId: session.studentId,
        author: "STUDENT",
        context: ({ sesion: "SESSION", ejercicio: "EXERCISE", evaluacion: "EVALUATION", general: "GENERAL" } as const)[input.context],
        category: ({ consulta: "QUESTION", dificultad: "DIFFICULTY", dolor: "PAIN", devolucion: "FEEDBACK" } as const)[input.category],
        body,
        sessionId: input.sessionId || null,
        exerciseId: input.exerciseId || null,
        evaluationId: input.evaluationId || null,
      },
    });
    return Response.json({ id: created.id }, { status: 201 });
  } catch (error) {
    console.error("Error al crear comentario del portal", error);
    return Response.json({ error: "No se pudo enviar el comentario." }, { status: 500 });
  }
}
