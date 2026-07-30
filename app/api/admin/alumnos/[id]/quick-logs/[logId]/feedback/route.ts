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
  context: RouteContext<"/api/admin/alumnos/[id]/quick-logs/[logId]/feedback">,
) {
  if (!validRequestOrigin(request)) {
    return Response.json({ error: "Origen no permitido." }, { status: 403 });
  }
  const failure = await authorize();
  if (failure) {
    return Response.json({ error: failure.error }, { status: failure.status });
  }
  const { id: studentId, logId } = await context.params;
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

  const [log, settingsRecord] = await Promise.all([
    prisma.quickLog.findFirst({
      where: { id: logId, studentId },
      select: { id: true, exerciseName: true, title: true },
    }),
    prisma.coachSettingsRecord.findFirst({ select: { data: true } }),
  ]);
  if (!log) {
    return Response.json(
      { error: "No se encontró el registro del alumno." },
      { status: 404 },
    );
  }
  const coach = settingsRecord?.data as unknown as CoachSettings | undefined;
  const trainerName = coach?.coachName?.trim() || "Tu entrenador";
  const existing = await prisma.quickLogFeedback.findUnique({
    where: { quickLogId: log.id },
  });
  if (
    existing &&
    existing.preset === preset &&
    existing.text === text &&
    existing.trainerName === trainerName
  ) {
    return Response.json({
      feedback: existing,
      message: "La devolución ya estaba guardada.",
    });
  }

  const feedback = await prisma.$transaction(async (transaction) => {
    const saved = await transaction.quickLogFeedback.upsert({
      where: { quickLogId: log.id },
      create: {
        quickLogId: log.id,
        studentId,
        trainerName,
        preset,
        text,
      },
      update: { trainerName, preset, text },
    });
    await transaction.studentNotification.create({
      data: {
        studentId,
        type: "FEEDBACK",
        title: "Nueva devolución",
        message: `Tu entrenador dejó una devolución en ${log.exerciseName || log.title || "tu registro"}.`,
        url: `/portal/registro#registro-${log.id}`,
      },
    });
    return saved;
  });

  await sendStudentPush(studentId, {
    title: "Nueva devolución en BM Training",
    body: `Tu entrenador dejó una devolución en ${log.exerciseName || log.title || "tu registro"}.`,
    url: `/portal/registro#registro-${log.id}`,
    tag: `quick-log-feedback-${log.id}`,
  });

  return Response.json({
    feedback,
    message: "Devolución guardada correctamente.",
  });
}
