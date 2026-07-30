import "server-only";

import { Prisma, type QuickLogAchievementType } from "@prisma/client";
import { normalizeExerciseName } from "@/lib/exercise-name";
import { prisma } from "@/lib/prisma";
import type { PortalAchievement } from "@/lib/portal-achievements";

const MILESTONES = [5, 10, 25, 50, 100] as const;

type DbClient = Prisma.TransactionClient;

type StrengthRecord = {
  id: string;
  studentId: string;
  exerciseName: string;
  exerciseKey: string;
  sets: number | null;
  repetitions: number | null;
  currentValue: Prisma.Decimal | null;
  previousValue?: Prisma.Decimal | null;
  unit: string;
  date: Date;
  createdAt: Date;
};

type AchievementDraft = {
  studentId: string;
  quickLogId: string;
  achievementKey: string;
  type: QuickLogAchievementType;
  exerciseName: string;
  exerciseKey: string;
  sets: number | null;
  repetitions: number | null;
  unit: string;
  currentLoad: Prisma.Decimal | null;
  previousLoad: Prisma.Decimal | null;
  difference: Prisma.Decimal | null;
  recordCount: number | null;
  unlockedAt: Date;
};

function decimal(value: Prisma.Decimal | null) {
  return value === null ? null : Number(value);
}

function difference(current: Prisma.Decimal | null, previous: Prisma.Decimal | null) {
  if (current === null || previous === null) return null;
  return new Prisma.Decimal(decimal(current)! - decimal(previous)!);
}

function draft(
  log: StrengthRecord,
  type: QuickLogAchievementType,
  achievementKey: string,
  previousLoad: Prisma.Decimal | null,
  recordCount: number | null = null,
): AchievementDraft {
  return {
    studentId: log.studentId,
    quickLogId: log.id,
    achievementKey,
    type,
    exerciseName: log.exerciseName,
    exerciseKey: log.exerciseKey,
    sets: log.sets,
    repetitions: log.repetitions,
    unit: log.unit,
    currentLoad: log.currentValue,
    previousLoad,
    difference: difference(log.currentValue, previousLoad),
    recordCount,
    unlockedAt: log.date,
  };
}

export async function recalculateQuickLogAchievements(
  tx: DbClient,
  studentId: string,
  originQuickLogId?: string,
) {
  const logs = await tx.quickLog.findMany({
    where: {
      studentId,
      type: "PROGRESS",
      metricType: "carga",
      exerciseName: { not: "" },
      currentValue: { not: null },
      sets: { not: null },
      repetitions: { not: null },
    },
    select: {
      id: true,
      studentId: true,
      exerciseName: true,
      exerciseKey: true,
      sets: true,
      repetitions: true,
      currentValue: true,
      previousValue: true,
      unit: true,
      date: true,
      createdAt: true,
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });

  const previousByExercise = new Map<string, StrengthRecord>();
  const maximumByExercise = new Map<string, Prisma.Decimal>();
  const repetitionsByCondition = new Map<string, number>();
  const achievements: AchievementDraft[] = [];

  for (let index = 0; index < logs.length; index += 1) {
    const raw = logs[index];
    const exerciseKey = normalizeExerciseName(raw.exerciseName);
    const log = { ...raw, exerciseKey };
    const previous = previousByExercise.get(exerciseKey);
    const previousLoad = previous?.currentValue ?? null;

    if (
      raw.exerciseKey !== exerciseKey ||
      decimal(raw.previousValue ?? null) !== decimal(previousLoad)
    ) {
      await tx.quickLog.update({
        where: { id: raw.id },
        data: {
          exerciseKey,
          previousValue: previousLoad,
          previousSets: previous?.sets ?? null,
          previousRepetitions: previous?.repetitions ?? null,
        },
      });
    }

    if (!previous) {
      achievements.push(
        draft(log, "FIRST_MARK", `quick-log:first:${exerciseKey}`, null),
      );
    } else {
      const maximum = maximumByExercise.get(exerciseKey);
      if (
        maximum &&
        raw.currentValue &&
        raw.currentValue.comparedTo(maximum) > 0
      ) {
        achievements.push(
          draft(log, "MAX_LOAD", `quick-log:max:${raw.id}`, maximum),
        );
      }

      if (raw.currentValue && raw.sets !== null && raw.repetitions !== null) {
        const condition = `${exerciseKey}|${raw.currentValue.toString()}|${raw.sets}`;
        const previousBest = repetitionsByCondition.get(condition);
        if (previousBest !== undefined && raw.repetitions > previousBest) {
          const item = draft(
            log,
            "REPETITION_PR",
            `quick-log:repetitions:${raw.id}`,
            raw.currentValue,
          );
          item.difference = new Prisma.Decimal(raw.repetitions - previousBest);
          achievements.push(item);
        }
      }
    }

    if (raw.currentValue) {
      const currentMaximum = maximumByExercise.get(exerciseKey);
      if (!currentMaximum || raw.currentValue.comparedTo(currentMaximum) > 0) {
        maximumByExercise.set(exerciseKey, raw.currentValue);
      }
      if (raw.sets !== null && raw.repetitions !== null) {
        const condition = `${exerciseKey}|${raw.currentValue.toString()}|${raw.sets}`;
        repetitionsByCondition.set(
          condition,
          Math.max(
            repetitionsByCondition.get(condition) ?? 0,
            raw.repetitions,
          ),
        );
      }
    }
    previousByExercise.set(exerciseKey, log);

    const count = index + 1;
    if (MILESTONES.includes(count as (typeof MILESTONES)[number])) {
      achievements.push(
        draft(
          log,
          "RECORD_MILESTONE",
          `quick-log:milestone:${count}`,
          previousLoad,
          count,
        ),
      );
    }
  }

  await tx.quickLogAchievement.deleteMany({ where: { studentId } });
  if (achievements.length) {
    await tx.quickLogAchievement.createMany({
      data: achievements,
      skipDuplicates: true,
    });
  }

  return originQuickLogId
    ? achievements.filter((item) => item.quickLogId === originQuickLogId)
    : [];
}

function loadLabel(type: QuickLogAchievementType) {
  if (type === "FIRST_MARK") return "Primera marca registrada";
  if (type === "MAX_LOAD") return "Nueva carga máxima";
  if (type === "REPETITION_PR") return "Nuevo récord de repeticiones";
  return "Hito de registros";
}

function numericSummary(item: {
  sets: number | null;
  repetitions: number | null;
  currentLoad: Prisma.Decimal | null;
  previousLoad: Prisma.Decimal | null;
  difference: Prisma.Decimal | null;
  recordCount: number | null;
  exerciseName: string;
  type: QuickLogAchievementType;
  unit: string;
}) {
  const unit = item.unit || "kg";
  if (item.type === "RECORD_MILESTONE") {
    return `${item.recordCount ?? 0} registros completados. Último registro: ${item.exerciseName}.`;
  }
  const work =
    item.sets !== null && item.repetitions !== null
      ? `${item.sets} × ${item.repetitions}`
      : "";
  const load =
    item.currentLoad !== null
      ? `${Number(item.currentLoad).toLocaleString("es-AR")} ${unit}`
      : "";
  if (item.type === "FIRST_MARK") {
    return [work, load].filter(Boolean).join(" · ");
  }
  if (item.type === "REPETITION_PR") {
    return `${work} · ${load}. Superaste tu mejor cantidad de repeticiones en la misma condición.`;
  }
  const gain =
    item.difference !== null
      ? `+${Number(item.difference).toLocaleString("es-AR")} ${unit}`
      : "";
  return `${work} · ${load}${gain ? ` · ${gain}` : ""}`;
}

export async function loadQuickLogAchievements(
  studentId: string,
): Promise<PortalAchievement[]> {
  let [items, count] = await Promise.all([
    prisma.quickLogAchievement.findMany({
      where: { studentId },
      orderBy: [{ unlockedAt: "desc" }, { createdAt: "desc" }],
      include: {
        quickLog: {
          select: { feedback: { select: { text: true } } },
        },
      },
    }),
    prisma.quickLog.count({
      where: {
        studentId,
        type: "PROGRESS",
        metricType: "carga",
        currentValue: { not: null },
        sets: { not: null },
        repetitions: { not: null },
      },
    }),
  ]);
  if (count > 0 && items.length === 0) {
    await prisma.$transaction(
      (transaction) =>
        recalculateQuickLogAchievements(transaction, studentId),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ).catch((error) => {
      console.error("No se pudo reconstruir los logros de registros", error);
    });
    items = await prisma.quickLogAchievement.findMany({
      where: { studentId },
      orderBy: [{ unlockedAt: "desc" }, { createdAt: "desc" }],
      include: {
        quickLog: {
          select: { feedback: { select: { text: true } } },
        },
      },
    });
    if (items.length) {
      await prisma.achievementNotification.createMany({
        data: items.map((item) => ({
          studentId,
          achievementKey: item.achievementKey,
          unlockedAt: item.unlockedAt,
          status: "BASELINE",
        })),
        skipDuplicates: true,
      });
    }
    count = await prisma.quickLog.count({
      where: {
        studentId,
        type: "PROGRESS",
        metricType: "carga",
        currentValue: { not: null },
        sets: { not: null },
        repetitions: { not: null },
      },
    });
  }
  const achievements: PortalAchievement[] = items.map((item) => ({
    id: item.achievementKey,
    icon: item.type === "RECORD_MILESTONE" ? "◆" : "▲",
    name: loadLabel(item.type),
    description: numericSummary(item),
    unlocked: true,
    unlockedAt: item.unlockedAt.toISOString().slice(0, 10),
    progress: item.recordCount ?? 1,
    target: item.recordCount ?? 1,
    category: "PROGRESO",
    level:
      item.type === "RECORD_MILESTONE" &&
      (item.recordCount ?? 0) >= 50
        ? "ESPECIAL"
        : item.type === "MAX_LOAD"
          ? "DESTACADO"
          : "COMUN",
    exercise: item.exerciseName,
    previousValue:
      item.previousLoad === null
        ? undefined
        : `${Number(item.previousLoad).toLocaleString("es-AR")} ${item.unit || "kg"}`,
    newValue:
      item.currentLoad === null
        ? undefined
        : `${Number(item.currentLoad).toLocaleString("es-AR")} ${item.unit || "kg"}`,
    quickLogId: item.quickLogId,
    feedback: item.quickLog.feedback?.text,
    source: "QUICK_LOG",
  }));
  const next = MILESTONES.find((target) => target > count);
  if (next) {
    achievements.push({
      id: `quick-log:milestone:${next}`,
      icon: "◆",
      name: `${next} registros completados`,
      description: "Seguí registrando tus ejercicios para alcanzar el próximo hito.",
      unlocked: false,
      unlockedAt: "",
      progress: count,
      target: next,
      category: "PROGRESO",
      level: next >= 50 ? "ESPECIAL" : "DESTACADO",
      source: "QUICK_LOG",
    });
  }
  return achievements;
}
