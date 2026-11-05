import type { PortalWorkoutSession } from "../types/portal";

// The portal supplies only the authenticated student's sessions. Never use
// exercise.history here: it does not identify sessions and could repeat sets.
export function homeLoadEvolution(sessions: PortalWorkoutSession[]) {
  const exercises = new Map<string, { id: string; name: string; points: { date: string; weight: number; key: string }[] }>();
  const seen = new Set<string>();
  for (const session of sessions) {
    if (session.status !== "finalizado") continue;
    const key = session.id || `${session.routineId}:${session.dayId}:${session.date}:${session.startTime}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const maxima = new Map<string, { name: string; weight: number }>();
    for (const exercise of session.exercises) {
      if (!exercise.exerciseId) continue;
      const weights = exercise.sets.filter(set => set.completed && set.weight !== null && Number.isFinite(set.weight) && set.weight >= 0).map(set => set.weight as number);
      if (!weights.length) continue;
      const weight = Math.max(...weights);
      if (!maxima.has(exercise.exerciseId) || maxima.get(exercise.exerciseId)!.weight < weight) maxima.set(exercise.exerciseId, { name: exercise.exerciseName, weight });
    }
    for (const [id, value] of maxima) {
      const item = exercises.get(id) ?? { id, name: value.name, points: [] };
      item.points.push({ date: session.date, weight: value.weight, key: `${session.date}:${session.startTime}:${key}` });
      exercises.set(id, item);
    }
  }
  return [...exercises.values()].sort((a, b) => b.points.length - a.points.length || a.id.localeCompare(b.id)).slice(0, 3).map(item => ({
    ...item, points: item.points.sort((a, b) => a.key.localeCompare(b.key)).slice(-6),
  }));
}
