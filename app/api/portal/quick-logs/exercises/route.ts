import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
import { normalizeExerciseName } from "@/lib/exercise-name";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function serializeReference(log: {
  exerciseName: string;
  sets: number | null;
  repetitions: number | null;
  currentValue: { toString(): string } | null;
  unit: string;
  createdAt: Date;
}) {
  return {
    exerciseName: log.exerciseName,
    sets: log.sets,
    repetitions: log.repetitions,
    load: log.currentValue === null ? null : Number(log.currentValue),
    unit: log.unit || "kg",
    createdAt: log.createdAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const session = await getPortalSession();
  if (!session) {
    return Response.json({ error: "Sesión vencida." }, { status: 401 });
  }

  const requestedExercise =
    new URL(request.url).searchParams.get("exercise")?.trim().slice(0, 120) ?? "";
  const requestedKey = normalizeExerciseName(requestedExercise);
  const logs = await prisma.quickLog.findMany({
    where: {
      studentId: session.studentId,
      type: "PROGRESS",
      ...(requestedExercise
        ? { OR: [{ exerciseKey: requestedKey }, { exerciseName: { contains: requestedExercise, mode: "insensitive" } }] }
        : { exerciseName: { not: "" } }),
    },
    select: {
      exerciseName: true,
      sets: true,
      repetitions: true,
      currentValue: true,
      unit: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  if (requestedExercise) {
    const match = logs.find(
      (log) => normalizeExerciseName(log.exerciseName) === requestedKey,
    );
    return Response.json({ reference: match ? serializeReference(match) : null });
  }

  const routineExercises = await prisma.trainingRoutineExercise.findMany({
    where: {
      active: true,
      archivedAt: null,
      day: {
        active: true,
        archivedAt: null,
        routine: {
          assignments: {
            some: {
              studentId: session.studentId,
              active: true,
              archivedAt: null,
            },
          },
        },
      },
    },
    select: { name: true, muscleGroup: true },
  });

  const grouped = new Map<
    string,
    {
      name: string;
      muscleGroup: string | null;
      recent: boolean;
      count: number;
      lastUsedAt: string;
      reference: ReturnType<typeof serializeReference> | null;
    }
  >();
  for (const exercise of routineExercises) {
    const key = normalizeExerciseName(exercise.name);
    if (!key || grouped.has(key)) continue;
    grouped.set(key, {
      name: exercise.name,
      muscleGroup: exercise.muscleGroup || null,
      recent: false,
      count: 0,
      lastUsedAt: "",
      reference: null,
    });
  }
  for (const log of logs) {
    const key = normalizeExerciseName(log.exerciseName);
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      existing.recent = true;
      existing.lastUsedAt = existing.lastUsedAt > log.createdAt.toISOString() ? existing.lastUsedAt : log.createdAt.toISOString();
      existing.reference ??= serializeReference(log);
    } else {
      grouped.set(key, {
        name: log.exerciseName,
        muscleGroup: null,
        recent: true,
        count: 1,
        lastUsedAt: log.createdAt.toISOString(),
        reference: serializeReference(log),
      });
    }
  }

  const options = [...grouped.values()]
    .sort(
      (left, right) =>
        Number(right.recent) - Number(left.recent) ||
        right.lastUsedAt.localeCompare(left.lastUsedAt),
    )
    .slice(0, 200);

  return Response.json({
    options,
    lastRecord: logs[0] ? serializeReference(logs[0]) : null,
  });
}
