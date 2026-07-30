import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getPortalSession, validRequestOrigin } from "@/lib/portal-auth";
import { detectedImageType, MAX_QUICK_LOG_PHOTO_BYTES, QUICK_LOG_TYPES, quickLogJson, quickLogRelations } from "@/lib/quick-logs";
import { normalizeExerciseName } from "@/lib/exercise-name";
import { loadQuickLogAchievements, recalculateQuickLogAchievements } from "@/lib/quick-log-achievements";
import { notifyNewAchievements } from "@/lib/push-notifications";
import { reconcileStudentPointsAfterMutation } from "@/lib/student-points";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const type = params.get("type");
  const query = params.get("query")?.trim().slice(0, 100) ?? "";
  const from = params.get("from");
  const to = params.get("to");
  await loadQuickLogAchievements(session.studentId);
  const logs = await prisma.quickLog.findMany({
    where: {
      studentId: session.studentId,
      ...(type && QUICK_LOG_TYPES.includes(type as (typeof QUICK_LOG_TYPES)[number]) ? { type: type as (typeof QUICK_LOG_TYPES)[number] } : {}),
      ...(query ? { OR: [{ title: { contains: query, mode: "insensitive" } }, { content: { contains: query, mode: "insensitive" } }, { exerciseName: { contains: query, mode: "insensitive" } }] } : {}),
      ...((from || to) ? { date: { ...(from ? { gte: new Date(`${from}T00:00:00Z`) } : {}), ...(to ? { lte: new Date(`${to}T00:00:00Z`) } : {}) } } : {}),
    },
    include: quickLogRelations,
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return Response.json({ logs: logs.map(quickLogJson) });
}

export async function POST(request: Request) {
  if (!validRequestOrigin(request)) return Response.json({ error: "Origen no permitido." }, { status: 403 });
  const session = await getPortalSession();
  if (!session) return Response.json({ error: "Sesión vencida." }, { status: 401 });
  const form = await request.formData();
  const type = String(form.get("type") ?? "");
  const date = String(form.get("date") ?? "");
  if (!QUICK_LOG_TYPES.includes(type as (typeof QUICK_LOG_TYPES)[number]) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return Response.json({ error: "Tipo o fecha inválidos." }, { status: 400 });
  const text = (key: string, max: number) => String(form.get(key) ?? "").trim().slice(0, max);
  const number = (key: string) => {
    const value = String(form.get(key) ?? "").trim();
    if (!value) return null;
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  };
  const durationMinutes = number("durationMinutes");
  const sets = number("sets");
  const repetitions = number("repetitions");
  const previousValue = number("previousValue");
  const currentValue = number("currentValue");
  const metricType = text("metricType", 60);
  const exerciseName = text("exerciseName", 120);
  const exerciseKey = normalizeExerciseName(exerciseName);
  const idempotencyKey = text("idempotencyKey", 100) || null;
  if (
    (sets !== null && (!Number.isInteger(sets) || sets < 1 || sets > 100)) ||
    (repetitions !== null && (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 10000))
  ) return Response.json({ error: "Revisá las series y repeticiones." }, { status: 400 });
  if ((durationMinutes !== null && (!Number.isInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 1440)) || [previousValue, currentValue].some((value) => value !== null && (!Number.isFinite(value) || value < 0))) return Response.json({ error: "Revisá los valores numéricos." }, { status: 400 });
  if (type === "PROGRESS" && (!exerciseName || currentValue === null)) return Response.json({ error: "Ejercicio y nuevo valor son obligatorios." }, { status: 400 });
  if (type === "PROGRESS" && metricType === "carga" && (sets === null || repetitions === null)) return Response.json({ error: "Series y repeticiones son obligatorias." }, { status: 400 });
  const files = form.getAll("photos").filter((item): item is File => item instanceof File && item.size > 0);
  if (files.length > 4) return Response.json({ error: "Podés adjuntar hasta 4 fotos por registro." }, { status: 400 });
  if (files.length && !process.env.BLOB_READ_WRITE_TOKEN) return Response.json({ error: "La carga de fotos todavía no está configurada." }, { status: 503 });
  const checkedFiles: Array<{ bytes: Uint8Array; type: { mime: string; extension: string } }> = [];
  for (const file of files) {
    if (file.size > MAX_QUICK_LOG_PHOTO_BYTES) return Response.json({ error: "Cada foto debe pesar hasta 3 MB." }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const detected = detectedImageType(bytes);
    if (!detected || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) return Response.json({ error: "Las fotos deben ser JPG, PNG o WEBP válidos." }, { status: 400 });
    checkedFiles.push({ bytes, type: detected });
  }
  let log: { id: string };
  let repeatedRequest = false;
  try {
    log = await prisma.$transaction(async (transaction) => {
      if (idempotencyKey) {
        const existing = await transaction.quickLog.findUnique({
          where: { idempotencyKey },
          select: { id: true, studentId: true },
        });
        if (existing) {
          if (existing.studentId !== session.studentId) throw new Error("IDEMPOTENCY_CONFLICT");
          repeatedRequest = true;
          return { id: existing.id };
        }
      }
      const previous = type === "PROGRESS" && metricType === "carga"
        ? await transaction.quickLog.findFirst({
          where: {
            studentId: session.studentId,
            type: "PROGRESS",
            metricType: "carga",
            exerciseKey,
            currentValue: { not: null },
          },
          select: { currentValue: true },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        })
        : null;
      const created = await transaction.quickLog.create({
        data: {
          studentId: session.studentId,
          type: type as (typeof QUICK_LOG_TYPES)[number],
          title: text("title", 120),
          content: text("content", 5000),
          category: text("category", 60),
          date: new Date(`${date}T00:00:00Z`),
          durationMinutes,
          exerciseName,
          exerciseKey,
          idempotencyKey,
          sets,
          repetitions,
          metricType,
          previousValue: previous?.currentValue ?? previousValue,
          currentValue,
          unit: text("unit", 30),
          mood: text("mood", 60),
          hasPain: form.get("hasPain") === "true",
          painDetails: text("painDetails", 1000),
        },
        select: { id: true },
      });
      if (type === "PROGRESS" && metricType === "carga") {
        await recalculateQuickLogAchievements(
          transaction,
          session.studentId,
          created.id,
        );
      }
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  } catch (error) {
    if (error instanceof Error && error.message === "IDEMPOTENCY_CONFLICT") {
      return Response.json({ error: "No se pudo validar este reintento." }, { status: 409 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002" && idempotencyKey) {
      const existing = await prisma.quickLog.findFirst({ where: { idempotencyKey, studentId: session.studentId }, select: { id: true } });
      if (!existing) return Response.json({ error: "El registro ya fue procesado." }, { status: 409 });
      log = existing;
      repeatedRequest = true;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return Response.json(
        { error: "El historial cambió mientras guardabas. Reintentá el registro." },
        { status: 409 },
      );
    } else {
      throw error;
    }
  }
  if (repeatedRequest) {
    const existing = await prisma.quickLog.findUniqueOrThrow({ where: { id: log.id }, include: quickLogRelations });
    return Response.json({ log: quickLogJson(existing), message: "El registro ya estaba guardado." });
  }
  const uploaded: string[] = [];
  try {
    for (const file of checkedFiles) {
      const pathname = `quick-logs/${session.studentId}/${log.id}/${randomUUID()}.${file.type.extension}`;
      const blob = await put(pathname, Buffer.from(file.bytes), { access: "public", contentType: file.type.mime, addRandomSuffix: false });
      uploaded.push(blob.url);
      await prisma.quickLogPhoto.create({ data: { quickLogId: log.id, blobUrl: blob.url, blobPathname: pathname } });
    }
  } catch (error) {
    await Promise.all(uploaded.map((url) => del(url).catch(() => undefined)));
    await prisma.quickLog.delete({ where: { id: log.id } }).catch(() => undefined);
    await prisma.$transaction((transaction) => recalculateQuickLogAchievements(transaction, session.studentId)).catch(() => undefined);
    console.error("No se pudo guardar una foto del registro rápido", error);
    return Response.json({ error: "No se pudo guardar el registro. Intentá nuevamente." }, { status: 500 });
  }
  const saved = await prisma.quickLog.findUniqueOrThrow({ where: { id: log.id }, include: quickLogRelations });
  if (type === "PROGRESS" && metricType === "carga") {
    const historicalAchievements = await prisma.quickLogAchievement.findMany({
      where: { studentId: session.studentId, quickLogId: { not: log.id } },
      select: { achievementKey: true, unlockedAt: true },
    });
    if (historicalAchievements.length) {
      await prisma.achievementNotification.createMany({
        data: historicalAchievements.map((achievement) => ({
          studentId: session.studentId,
          achievementKey: achievement.achievementKey,
          unlockedAt: achievement.unlockedAt,
          status: "BASELINE",
        })),
        skipDuplicates: true,
      });
    }
    await notifyNewAchievements(session.studentId);
  }
  await reconcileStudentPointsAfterMutation(session.studentId);
  return Response.json({ log: quickLogJson(saved), message: "Registro guardado correctamente." }, { status: 201 });
}
