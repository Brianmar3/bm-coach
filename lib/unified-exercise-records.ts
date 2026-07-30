import "server-only";

import { normalizeExerciseName } from "@/lib/exercise-name";
import { prisma } from "@/lib/prisma";
import type {
  ExerciseRecordFeedback,
  UnifiedExerciseRecord,
} from "@/types/exercise-record";

type Candidate = Omit<
  UnifiedExerciseRecord,
  "id" | "previous" | "difference" | "marks"
>;

const number = (value: { toString(): string } | number | null) =>
  value === null ? null : Number(value);

function feedback(value: {
  id: string;
  trainerName: string;
  preset: string;
  text: string;
  createdAt: Date;
  updatedAt: Date;
} | null): ExerciseRecordFeedback | null {
  return value
    ? {
        ...value,
        createdAt: value.createdAt.toISOString(),
        updatedAt: value.updatedAt.toISOString(),
      }
    : null;
}

function bestSet(
  sets: Array<{
    setNumber: number;
    weight: { toString(): string } | number | null;
    repetitions: number | null;
    unit?: string;
  }>,
) {
  const valid = sets.flatMap((set) => {
    const weight = number(set.weight);
    return weight !== null &&
      weight >= 0 &&
      set.repetitions !== null &&
      set.repetitions > 0
      ? [
          {
            setNumber: set.setNumber,
            weight,
            repetitions: set.repetitions,
            unit: set.unit || "kg",
          },
        ]
      : [];
  });
  const best = [...valid].sort(
    (left, right) =>
      right.weight - left.weight || right.repetitions - left.repetitions,
  )[0];
  return best ? { best, valid } : null;
}

function applyComparisons(candidates: Candidate[]): UnifiedExerciseRecord[] {
  const ordered = [...candidates].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.sourceId.localeCompare(right.sourceId),
  );
  const history = new Map<string, UnifiedExerciseRecord[]>();
  const records: UnifiedExerciseRecord[] = [];

  for (const candidate of ordered) {
    const id = `${candidate.source.toLowerCase()}:${candidate.sourceId}`;
    const previousRecords = history.get(candidate.exerciseKey) ?? [];
    const previous = previousRecords.at(-1) ?? null;
    const maximum = previousRecords.length
      ? Math.max(...previousRecords.map((item) => item.load))
      : null;
    const marks: UnifiedExerciseRecord["marks"] = [];
    if (!previous) marks.push("FIRST_MARK");
    if (maximum !== null && candidate.load > maximum) marks.push("MAX_LOAD");
    const sameConditionBest = previousRecords
      .filter(
        (item) =>
          Math.abs(item.load - candidate.load) < 0.01 &&
          item.sets === candidate.sets,
      )
      .sort((left, right) => right.repetitions - left.repetitions)[0];
    if (
      sameConditionBest &&
      candidate.repetitions > sameConditionBest.repetitions
    ) {
      marks.push("REPETITION_PR");
    }
    const record: UnifiedExerciseRecord = {
      ...candidate,
      id,
      previous: previous
        ? {
            id: previous.id,
            date: previous.date,
            load: previous.load,
            sets: previous.sets,
            repetitions: previous.repetitions,
            unit: previous.unit,
            source: previous.source,
          }
        : null,
      difference: previous ? candidate.load - previous.load : null,
      marks,
    };
    records.push(record);
    history.set(candidate.exerciseKey, [...previousRecords, record]);
  }
  return records.sort(
    (left, right) =>
      right.date.localeCompare(left.date) ||
      right.createdAt.localeCompare(left.createdAt) ||
      right.id.localeCompare(left.id),
  );
}

export async function loadUnifiedExerciseRecords(studentId: string) {
  const [quickLogs, classLogs, routineSessions] = await Promise.all([
    prisma.quickLog.findMany({
      where: {
        studentId,
        type: "PROGRESS",
        metricType: "carga",
        exerciseName: { not: "" },
        currentValue: { not: null },
        sets: { not: null },
        repetitions: { not: null },
      },
      include: { feedback: true },
    }),
    prisma.classWorkoutLog.findMany({
      where: { studentId, status: "COMPLETED" },
      include: {
        exercises: {
          include: {
            sets: { orderBy: { setNumber: "asc" } },
            feedback: true,
          },
          orderBy: { order: "asc" },
        },
      },
    }),
    prisma.workoutSession.findMany({
      where: { studentId, status: "COMPLETED", hasPain: false },
      include: {
        exercises: {
          include: {
            exercise: { select: { name: true } },
            sets: {
              where: { completed: true },
              orderBy: { setNumber: "asc" },
            },
          },
        },
      },
    }),
  ]);

  const candidates: Candidate[] = [];
  for (const log of quickLogs) {
    if (
      log.currentValue === null ||
      log.sets === null ||
      log.repetitions === null
    ) {
      continue;
    }
    const load = Number(log.currentValue);
    candidates.push({
      source: "QUICK_LOG",
      sourceId: log.id,
      sessionId: log.id,
      exerciseName: log.exerciseName,
      exerciseKey: normalizeExerciseName(log.exerciseName),
      date: log.date.toISOString().slice(0, 10),
      createdAt: log.createdAt.toISOString(),
      sets: log.sets,
      repetitions: log.repetitions,
      load,
      unit: log.unit || "kg",
      setDetails: Array.from({ length: log.sets }, (_, index) => ({
        setNumber: index + 1,
        weight: load,
        repetitions: log.repetitions!,
        unit: log.unit || "kg",
      })),
      context: "Registro rápido",
      originLabel: "Registro rápido",
      recordedByLabel: "Registrado por el alumno",
      feedback: feedback(log.feedback),
    });
  }

  for (const session of classLogs) {
    for (const exercise of session.exercises) {
      const result = bestSet(exercise.sets);
      if (!result) continue;
      const recordedByLabel =
        session.createdBy === "STUDENT"
          ? "Registrado por el alumno"
          : session.createdBy === "TRAINER"
            ? "Cargado por el entrenador"
            : session.lastEditedBy === "TRAINER"
              ? "Cargado en clase · editado por el entrenador"
              : session.lastEditedBy === "STUDENT"
                ? "Cargado en clase · editado por el alumno"
                : "Cargado en clase";
      candidates.push({
        source: "CLASS",
        sourceId: exercise.id,
        sessionId: session.id,
        exerciseName: exercise.exerciseNameSnapshot,
        exerciseKey: normalizeExerciseName(exercise.exerciseNameSnapshot),
        date: session.classDateSnapshot.toISOString().slice(0, 10),
        createdAt: session.createdAt.toISOString(),
        sets: result.valid.length,
        repetitions: result.best.repetitions,
        load: result.best.weight,
        unit: result.best.unit,
        setDetails: result.valid,
        context: session.classNameSnapshot,
        originLabel: "Registro histórico de clase",
        recordedByLabel,
        feedback: feedback(exercise.feedback),
      });
    }
  }

  for (const session of routineSessions) {
    for (const exercise of session.exercises) {
      const result = bestSet(
        exercise.sets.map((set) => ({ ...set, unit: "kg" })),
      );
      if (!result) continue;
      const exerciseName =
        exercise.exerciseName?.trim() ||
        exercise.exercise?.name?.trim() ||
        "Ejercicio";
      candidates.push({
        source: "ROUTINE",
        sourceId: exercise.id,
        sessionId: session.id,
        exerciseName,
        exerciseKey: normalizeExerciseName(exerciseName),
        date: session.date.toISOString().slice(0, 10),
        createdAt: session.createdAt.toISOString(),
        sets: result.valid.length,
        repetitions: result.best.repetitions,
        load: result.best.weight,
        unit: result.best.unit,
        setDetails: result.valid,
        context: session.routineNameSnapshot,
        originLabel: "Rutina personalizada",
        recordedByLabel: "Registrado por el alumno",
        feedback: null,
      });
    }
  }

  return applyComparisons(candidates);
}
