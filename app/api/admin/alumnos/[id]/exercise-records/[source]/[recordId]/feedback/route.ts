import { cookies } from "next/headers";
import {
  ADMIN_SESSION_COOKIE,
  adminAuthError,
  verifyAdminSessionValue,
} from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { validRequestOrigin } from "@/lib/portal-auth";
import { sendStudentPush } from "@/lib/push-notifications";
import type { CoachSettings } from "@/types/gestion";

const PRESETS = [
  "Buen progreso.",
  "Mantener carga.",
  "Subir carga próxima sesión.",
  "Mejorar técnica.",
  "Reducir carga.",
  "Revisar ejecución.",
] as const;

async function authorize() {
  const auth = verifyAdminSessionValue(
    (await cookies()).get(ADMIN_SESSION_COOKIE)?.value,
  );
  return auth.ok ? null : adminAuthError(auth);
}

export async function PUT(
  request: Request,
  context: RouteContext<"/api/admin/alumnos/[id]/exercise-records/[source]/[recordId]/feedback">,
) {
  if (!validRequestOrigin(request)) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }
  const failure = await authorize();
  if (failure) {
    return Response.json({ error: failure.error }, { status: failure.status });
  }

  const { id: studentId, source, recordId } = await context.params;
  if (!["quick", "class"].includes(source)) {
    return Response.json({ error: "El origen no es válido." }, { status: 400 });
  }

  const input = (await request.json().catch(() => null)) as {
    preset?: unknown;
    text?: unknown;
  } | null;
  const preset =
    typeof input?.preset === "string" &&
    PRESETS.includes(input.preset as (typeof PRESETS)[number])
      ? input.preset
      : "";
  const custom =
    typeof input?.text === "string" ? input.text.trim().slice(0, 600) : "";
  const text = [preset, custom].filter(Boolean).join(" ");
  if (!text) {
    return Response.json(
      { error: "Elegí una devolución o escribí un comentario." },
      { status: 400 },
    );
  }

  const settingsRecord = await prisma.coachSettingsRecord.findFirst({
    select: { data: true },
  });
  const coach = settingsRecord?.data as unknown as CoachSettings | undefined;
  const trainerName = coach?.coachName?.trim() || "Tu entrenador";

  let exerciseName = "";
  let url = "/portal";
  let existing:
    | { preset: string; text: string; trainerName: string }
    | null = null;

  if (source === "quick") {
    const record = await prisma.quickLog.findFirst({
      where: { id: recordId, studentId },
      select: { exerciseName: true, feedback: true },
    });
    if (!record) {
      return Response.json(
        { error: "No se encontró el registro del alumno." },
        { status: 404 },
      );
    }
    exerciseName = record.exerciseName;
    existing = record.feedback;
    url = `/portal/registro#registro-${recordId}`;
  } else {
    const record = await prisma.classExerciseLog.findFirst({
      where: {
        id: recordId,
        workoutLog: { studentId, status: "COMPLETED" },
      },
      select: { exerciseNameSnapshot: true, feedback: true },
    });
    if (!record) {
      return Response.json(
        { error: "No se encontró el ejercicio de la clase." },
        { status: 404 },
      );
    }
    exerciseName = record.exerciseNameSnapshot;
    existing = record.feedback;
    url = "/portal/clases#devoluciones-clases";
  }

  if (
    existing &&
    existing.preset === preset &&
    existing.text === text &&
    existing.trainerName === trainerName
  ) {
    return Response.json({ message: "La devolución ya estaba guardada." });
  }

  await prisma.$transaction(async (transaction) => {
    if (source === "quick") {
      await transaction.quickLogFeedback.upsert({
        where: { quickLogId: recordId },
        create: {
          quickLogId: recordId,
          studentId,
          trainerName,
          preset,
          text,
        },
        update: { trainerName, preset, text },
      });
    } else {
      await transaction.classExerciseLogFeedback.upsert({
        where: { classExerciseLogId: recordId },
        create: {
          classExerciseLogId: recordId,
          studentId,
          trainerName,
          preset,
          text,
        },
        update: { trainerName, preset, text },
      });
    }
    await transaction.studentNotification.create({
      data: {
        studentId,
        type: "FEEDBACK",
        title: "Nueva devolución",
        message: `Tu entrenador dejó una devolución en ${exerciseName}.`,
        url,
      },
    });
  });

  await sendStudentPush(studentId, {
    title: "Nueva devolución en BM Training",
    body: `Tu entrenador dejó una devolución en ${exerciseName}.`,
    url,
    tag: `exercise-feedback-${source}-${recordId}`,
  });
  return Response.json({ message: "Devolución guardada correctamente." });
}
