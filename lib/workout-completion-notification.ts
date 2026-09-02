import type { StudentServiceType } from "@/types/gestion";

export type WorkoutCompletionNotificationInput = {
  studentId: string;
  sessionId: string;
  serviceType: StudentServiceType;
  studentName: string;
  sessionName?: string | null;
  durationMinutes?: number | null;
  exerciseCount?: number | null;
};

export function isWorkoutTrainerNotificationEligible(serviceType: StudentServiceType) {
  return serviceType === "PERSONALIZED" || serviceType === "MIXED";
}

export function workoutCompletionEventKey(sessionId: string) {
  return `workout-completed:${sessionId}`;
}

export function buildWorkoutCompletionNotification(input: WorkoutCompletionNotificationInput) {
  const studentName = input.studentName.trim() || "Un alumno";
  const details = [
    input.sessionName?.trim() || null,
    input.durationMinutes && input.durationMinutes > 0 ? `${input.durationMinutes} min` : null,
    input.exerciseCount && input.exerciseCount > 0
      ? `${input.exerciseCount} ejercicio${input.exerciseCount === 1 ? "" : "s"}`
      : null,
  ].filter((value): value is string => Boolean(value));
  const title = `${studentName} registró un entrenamiento`;
  return {
    eventKey: workoutCompletionEventKey(input.sessionId),
    title,
    message: details.length ? details.join(" · ") : "Entrenamiento completado.",
    url: `/alumnos?studentId=${encodeURIComponent(input.studentId)}&section=routines&entityId=${encodeURIComponent(input.sessionId)}#student-section-routines`,
    tag: `workout-completed-${input.sessionId}`,
  };
}
