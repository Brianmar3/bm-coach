import { prisma } from "@/lib/prisma";
import type { PortalAchievement } from "@/lib/portal-achievements";

type PerformanceSet = { weight: number; repetitions: number; effort: number | null };
type PerformanceRecord = {
  sessionId: string;
  source: "ROUTINE" | "CLASS";
  exerciseKey: string;
  exerciseName: string;
  date: string;
  sets: PerformanceSet[];
};

const normalizeExerciseName = (value: string) => value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().replace(/\s+/g, " ").toLowerCase();
const number = (value: { toString(): string } | number | null) => value === null ? null : Number(value);
const display = (value: number) => new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value);
const volume = (sets: PerformanceSet[]) => sets.reduce((total, set) => total + set.weight * set.repetitions, 0);
const averageEffort = (sets: PerformanceSet[]) => sets.every((set) => set.effort !== null)
  ? sets.reduce((total, set) => total + (set.effort ?? 0), 0) / sets.length
  : null;
const comparableWeight = (left: number, right: number) => Math.abs(left - right) < 0.01;

function achievement(record: PerformanceRecord, type: "weight" | "reps" | "sets" | "rir" | "volume", previousValue: string, newValue: string): PortalAchievement {
  const labels = {
    weight: ["Nueva carga máxima", "Superaste tu mejor carga manteniendo repeticiones comparables.", "FUERZA"],
    reps: ["Nuevo récord de repeticiones", "Superaste tus repeticiones con la misma carga.", "REPETICIONES"],
    sets: ["Más volumen completado", "Completaste más series válidas en condiciones comparables.", "VOLUMEN"],
    rir: ["Mejor control de carga", "Mantuviste el trabajo con un RIR mayor.", "FUERZA"],
    volume: ["Nuevo récord de volumen", "Superaste tu volumen total con datos completos.", "VOLUMEN"],
  } as const;
  const [name, description, category] = labels[type];
  return {
    id: `performance-${record.source.toLowerCase()}-${record.exerciseKey}-${type}-${record.sessionId}`,
    icon: type === "reps" ? "↗" : type === "rir" ? "◎" : "▲",
    name,
    description,
    unlocked: true,
    unlockedAt: record.date,
    progress: 1,
    target: 1,
    category,
    level: type === "weight" || type === "volume" ? "DESTACADO" : "COMUN",
    exercise: record.exerciseName,
    previousValue,
    newValue,
    sessionId: record.sessionId,
    source: record.source,
  };
}

export function calculateStrengthAchievements(records: PerformanceRecord[]) {
  const sorted = [...records].sort((left, right) => left.date.localeCompare(right.date) || left.sessionId.localeCompare(right.sessionId));
  const history = new Map<string, PerformanceRecord[]>();
  const results: PortalAchievement[] = [];
  for (const current of sorted) {
    if (!current.sets.length) continue;
    const key = `${current.source}:${current.exerciseKey}`;
    const previousRecords = history.get(key) ?? [];
    const previousSets = previousRecords.flatMap((record) => record.sets);
    if (previousSets.length) {
      const currentBestWeight = [...current.sets].sort((left, right) => right.weight - left.weight || right.repetitions - left.repetitions)[0];
      const previousBestWeight = [...previousSets].sort((left, right) => right.weight - left.weight || right.repetitions - left.repetitions)[0];
      if (previousBestWeight && currentBestWeight.weight > previousBestWeight.weight && currentBestWeight.repetitions >= previousBestWeight.repetitions) {
        results.push(achievement(current, "weight", `${display(previousBestWeight.weight)} kg × ${previousBestWeight.repetitions}`, `${display(currentBestWeight.weight)} kg × ${currentBestWeight.repetitions}`));
      }

      const repetitionCandidates = current.sets.flatMap((set) => {
        const previous = previousSets.filter((item) => comparableWeight(item.weight, set.weight)).sort((left, right) => right.repetitions - left.repetitions)[0];
        return previous && set.repetitions > previous.repetitions ? [{ current: set, previous }] : [];
      }).sort((left, right) => (right.current.repetitions - right.previous.repetitions) - (left.current.repetitions - left.previous.repetitions));
      if (repetitionCandidates[0]) {
        const item = repetitionCandidates[0];
        results.push(achievement(current, "reps", `${display(item.previous.weight)} kg × ${item.previous.repetitions}`, `${display(item.current.weight)} kg × ${item.current.repetitions}`));
      }

      const previousSession = previousRecords.at(-1);
      const previousMostSets = [...previousRecords].sort((left, right) => right.sets.length - left.sets.length)[0];
      if (previousMostSets && current.sets.length > previousMostSets.sets.length) {
        const previousMinWeight = Math.min(...previousMostSets.sets.map((set) => set.weight));
        const currentMinWeight = Math.min(...current.sets.map((set) => set.weight));
        const previousMinReps = Math.min(...previousMostSets.sets.map((set) => set.repetitions));
        const currentMinReps = Math.min(...current.sets.map((set) => set.repetitions));
        if (currentMinWeight >= previousMinWeight && currentMinReps >= previousMinReps) {
          results.push(achievement(current, "sets", `${previousMostSets.sets.length} series`, `${current.sets.length} series`));
        }
      }

      if (previousSession && current.sets.length === previousSession.sets.length) {
        const sameWork = current.sets.every((set, index) => comparableWeight(set.weight, previousSession.sets[index].weight) && set.repetitions === previousSession.sets[index].repetitions);
        const currentRir = averageEffort(current.sets);
        const previousRir = averageEffort(previousSession.sets);
        if (sameWork && currentRir !== null && previousRir !== null && currentRir > previousRir) {
          results.push(achievement(current, "rir", `RIR ${display(previousRir)}`, `RIR ${display(currentRir)}`));
        }
      }

      const currentVolume = volume(current.sets);
      const previousBestVolume = Math.max(...previousRecords.map((record) => volume(record.sets)));
      if (currentVolume > previousBestVolume && current.sets.every((set) => set.weight > 0 && set.repetitions > 0)) {
        results.push(achievement(current, "volume", `${display(previousBestVolume)} kg·rep`, `${display(currentVolume)} kg·rep`));
      }
    }
    history.set(key, [...previousRecords, current]);
  }
  return results;
}

export async function loadStrengthAchievements(studentId: string, activityStart?: Date) {
  const [routineSessions, classSessions] = await Promise.all([
    prisma.workoutSession.findMany({
      where: { studentId, status: "COMPLETED", hasPain: false, ...(activityStart ? { date: { gte: activityStart } } : {}) },
      select: {
        id: true, date: true,
        exercises: { select: { exerciseReferenceId: true, exerciseName: true, targetRepetitions: true, sets: { where: { completed: true }, select: { weight: true, repetitions: true, effort: true }, orderBy: { setNumber: "asc" } } } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.classWorkoutLog.findMany({
      where: { studentId, status: "COMPLETED", ...(activityStart ? { classDateSnapshot: { gte: activityStart } } : {}) },
      select: { id: true, classDateSnapshot: true, exercises: { select: { exerciseNameSnapshot: true, sets: { select: { weight: true, repetitions: true, effort: true }, orderBy: { setNumber: "asc" } } } } },
      orderBy: [{ classDateSnapshot: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  const records: PerformanceRecord[] = [];
  for (const session of routineSessions) for (const exercise of session.exercises) {
    const targetMinimum = Number(exercise.targetRepetitions?.match(/\d+/)?.[0] ?? 0);
    const sets = exercise.sets.flatMap((set) => {
      const weight = number(set.weight); const repetitions = set.repetitions; const effort = number(set.effort);
      return weight !== null && weight > 0 && repetitions !== null && repetitions > 0 && (!targetMinimum || repetitions >= targetMinimum)
        ? [{ weight, repetitions, effort }] : [];
    });
    if (sets.length) records.push({ sessionId: session.id, source: "ROUTINE", exerciseKey: exercise.exerciseReferenceId, exerciseName: exercise.exerciseName?.trim() || "Ejercicio", date: session.date.toISOString().slice(0, 10), sets });
  }
  for (const session of classSessions) for (const exercise of session.exercises) {
    const normalizedName = normalizeExerciseName(exercise.exerciseNameSnapshot);
    const sets = exercise.sets.flatMap((set) => {
      const weight = number(set.weight); const repetitions = set.repetitions; const effort = number(set.effort);
      return weight !== null && weight > 0 && repetitions !== null && repetitions > 0 ? [{ weight, repetitions, effort }] : [];
    });
    if (normalizedName && sets.length) records.push({ sessionId: session.id, source: "CLASS", exerciseKey: normalizedName, exerciseName: exercise.exerciseNameSnapshot, date: session.classDateSnapshot.toISOString().slice(0, 10), sets });
  }
  return calculateStrengthAchievements(records);
}
