export type DashboardCompletedWorkout = {
  sessionId: string;
  studentId: string;
  studentName: string;
  routineId: string | null;
  routineName: string;
  date: string;
  completedAt: string;
};

export function completedWorkoutPriorityHref(workouts: DashboardCompletedWorkout[]) {
  const params = new URLSearchParams({ tab: "seguimiento" });
  if (workouts.length === 1) {
    params.set("studentId", workouts[0].studentId);
    params.set("sessionId", workouts[0].sessionId);
  } else if (workouts.length > 1) {
    const studentIds = [...new Set(workouts.map((item) => item.studentId))];
    if (studentIds.length === 1) params.set("studentId", studentIds[0]);
    else params.set("studentIds", studentIds.join(","));
    params.set("sessionIds", workouts.map((item) => item.sessionId).join(","));
  }
  return `/rutinas?${params.toString()}`;
}

export function completedWorkoutPrioritySubtitle(workouts: DashboardCompletedWorkout[]) {
  if (workouts.length !== 1) return "Revisar sesiones recientes";
  return `${workouts[0].studentName} · ${workouts[0].routineName}`;
}
