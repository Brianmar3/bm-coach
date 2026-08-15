import { bodyMetricDelta, expectedRoutineSessions, routineCompliance } from "./routine-follow-up-metrics.ts";
import type { PortalExerciseRecord, PortalProgressData, PortalProgressMetric, PortalProgressMetricKey } from "../types/portal-progress.ts";

type ProgressSet = { completed: boolean; weight: number | null; repetitions: number | null };
type ProgressExercise = { exerciseReferenceId: string; exerciseName: string; sets: ProgressSet[] };
type ProgressSession = {
  id: string;
  date: string;
  routineName: string;
  dayNumber: number;
  dayName: string;
  durationMinutes: number | null;
  blocks: Array<{ completed: boolean }>;
  exercises: ProgressExercise[];
};
type ProgressEvaluation = { date: string } & Record<PortalProgressMetricKey, number | null>;

const BODY_METRICS: Array<{ key: PortalProgressMetricKey; label: string; unit: string }> = [
  { key: "weight", label: "Peso", unit: "kg" },
  { key: "bodyFatPercentage", label: "Grasa corporal", unit: "%" },
  { key: "muscleMass", label: "Masa muscular", unit: "kg" },
  { key: "waist", label: "Cintura", unit: "cm" },
  { key: "hip", label: "Cadera", unit: "cm" },
  { key: "chest", label: "Pecho", unit: "cm" },
];

export function buildBodyProgress(evaluations: ProgressEvaluation[]): PortalProgressMetric[] {
  const ordered = [...evaluations].sort((left, right) => left.date.localeCompare(right.date));
  return BODY_METRICS.flatMap(({ key, label, unit }) => {
    const points = ordered.flatMap((evaluation) => evaluation[key] === null ? [] : [{ date: evaluation.date, value: evaluation[key]! }]);
    if (!points.length) return [];
    return [{ key, label, unit, points, change: bodyMetricDelta(points.map((point) => point.value)) }];
  });
}

export function buildExerciseRecords(sessions: ProgressSession[]): PortalExerciseRecord[] {
  const records = new Map<string, PortalExerciseRecord>();
  for (const session of sessions) {
    for (const exercise of session.exercises) {
      const completed = exercise.sets.filter((set) => set.completed);
      if (!completed.length) continue;
      const current = records.get(exercise.exerciseReferenceId) ?? {
        exerciseId: exercise.exerciseReferenceId,
        exerciseName: exercise.exerciseName,
        maximumWeight: null,
        maximumRepetitions: null,
        lastRecordedAt: session.date,
      };
      for (const set of completed) {
        if (set.weight !== null && (current.maximumWeight === null || set.weight > current.maximumWeight)) current.maximumWeight = set.weight;
        if (set.repetitions !== null && (current.maximumRepetitions === null || set.repetitions > current.maximumRepetitions)) current.maximumRepetitions = set.repetitions;
      }
      if (session.date > current.lastRecordedAt) {
        current.lastRecordedAt = session.date;
        current.exerciseName = exercise.exerciseName;
      }
      records.set(exercise.exerciseReferenceId, current);
    }
  }
  return [...records.values()]
    .filter((record) => record.maximumWeight !== null || record.maximumRepetitions !== null)
    .sort((left, right) => right.lastRecordedAt.localeCompare(left.lastRecordedAt) || left.exerciseName.localeCompare(right.exerciseName, "es"))
    .slice(0, 3);
}

export function buildPortalProgress(input: {
  plan: PortalProgressData["plan"];
  sessions: ProgressSession[];
  evaluations: ProgressEvaluation[];
  today?: Date;
}): PortalProgressData {
  const sessions = [...input.sessions].sort((left, right) => right.date.localeCompare(left.date));
  const durations = sessions.flatMap((session) => session.durationMinutes !== null && session.durationMinutes > 0 ? [session.durationMinutes] : []);
  const expectedSessions = expectedRoutineSessions({
    assignedAt: input.plan.assignedAt,
    startDate: input.plan.startDate,
    durationWeeks: input.plan.durationWeeks,
    plannedDays: input.plan.plannedDays,
    today: input.today,
  });
  return {
    plan: input.plan,
    summary: {
      completedSessions: sessions.length,
      expectedSessions,
      adherencePercentage: routineCompliance(sessions.length, expectedSessions),
      totalDurationMinutes: durations.length ? durations.reduce((sum, value) => sum + value, 0) : null,
      lastSessionDate: sessions[0]?.date ?? null,
      completedBlocks: sessions.reduce((sum, session) => sum + session.blocks.filter((block) => block.completed).length, 0),
      registeredExercises: sessions.reduce((sum, session) => sum + session.exercises.filter((exercise) => exercise.sets.some((set) => set.completed)).length, 0),
      completedSets: sessions.reduce((sum, session) => sum + session.exercises.reduce((subtotal, exercise) => subtotal + exercise.sets.filter((set) => set.completed).length, 0), 0),
      evaluationCount: input.evaluations.length,
    },
    bodyProgress: buildBodyProgress(input.evaluations),
    exerciseProgress: buildExerciseRecords(sessions),
    recentSessions: sessions.slice(0, 3).map(({ id, date, routineName, dayNumber, dayName, durationMinutes }) => ({ id, date, routineName, dayNumber, dayName, durationMinutes })),
  };
}
