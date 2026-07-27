export type PortalAchievement = {
  id: string;
  icon: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string;
  progress: number;
  target: number;
  category?: "FUERZA" | "REPETICIONES" | "VOLUMEN" | "TIEMPO" | "CONSTANCIA" | "EVALUACIONES";
  exercise?: string;
  previousValue?: string;
  newValue?: string;
  sessionId?: string;
  source?: "ROUTINE" | "CLASS";
};

type AchievementFacts = {
  completedWorkoutDates: string[];
  completedWorkoutCount: number;
  attendedClassDates: string[];
  attendedClassCount: number;
  firstEvaluationDate: string;
  latestEvaluationDate: string;
  evaluationCount: number;
  firstStrengthLogDate: string;
  joinedAt: string;
  today: string;
};

const daysBetween = (start: string, end: string) => {
  const startTime = Date.parse(`${start.slice(0, 10)}T12:00:00Z`);
  const endTime = Date.parse(`${end.slice(0, 10)}T12:00:00Z`);
  return Number.isFinite(startTime) && Number.isFinite(endTime) ? Math.floor((endTime - startTime) / 86400000) : 0;
};

const addDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

export function calculatePortalAchievements(facts: AchievementFacts): PortalAchievement[] {
  const workout = (target: number, name: string): PortalAchievement => ({
    id: `workouts-${target}`,
    icon: "◆",
    name,
    description: target === 1 ? "Finalizaste tu primera sesión." : `Completaste ${target} entrenamientos.`,
    unlocked: facts.completedWorkoutCount >= target,
    unlockedAt: facts.completedWorkoutDates[target - 1] ?? "",
    progress: Math.min(facts.completedWorkoutCount, target),
    target,
  });
  const attendance = (target: number, name: string): PortalAchievement => ({
    id: `classes-${target}`,
    icon: "●",
    name,
    description: target === 1 ? "Registraste tu primera asistencia real." : `Asististe a ${target} clases.`,
    unlocked: facts.attendedClassCount >= target,
    unlockedAt: facts.attendedClassDates[target - 1] ?? "",
    progress: Math.min(facts.attendedClassCount, target),
    target,
  });
  const activeDays = Math.max(0, daysBetween(facts.joinedAt, facts.today));
  return [
    workout(1, "Primer entrenamiento completado"),
    workout(5, "5 entrenamientos realizados"),
    workout(10, "10 entrenamientos realizados"),
    attendance(1, "Primera clase asistida"),
    attendance(5, "5 clases asistidas"),
    attendance(10, "10 clases asistidas"),
    {
      id: "first-evaluation",
      icon: "◇",
      name: "Primera evaluación registrada",
      description: "Ya tenés un punto de partida para medir tu progreso.",
      unlocked: Boolean(facts.firstEvaluationDate),
      unlockedAt: facts.firstEvaluationDate,
      progress: facts.firstEvaluationDate ? 1 : 0,
      target: 1,
    },
    {
      id: "two-evaluations",
      icon: "◇",
      name: "Dos evaluaciones completadas",
      description: "Ya podés comparar dos momentos de tu evolución corporal.",
      unlocked: facts.evaluationCount >= 2,
      unlockedAt: facts.evaluationCount >= 2 ? facts.latestEvaluationDate : "",
      progress: Math.min(facts.evaluationCount, 2),
      target: 2,
    },
    {
      id: "three-months-body-tracking",
      icon: "◇",
      name: "Tres meses de seguimiento corporal",
      description: "Tus evaluaciones abarcan al menos tres meses.",
      unlocked: facts.evaluationCount >= 2 && daysBetween(facts.firstEvaluationDate, facts.latestEvaluationDate) >= 90,
      unlockedAt: facts.evaluationCount >= 2 && daysBetween(facts.firstEvaluationDate, facts.latestEvaluationDate) >= 90 ? facts.latestEvaluationDate : "",
      progress: Math.min(Math.max(0, daysBetween(facts.firstEvaluationDate, facts.latestEvaluationDate)), 90),
      target: 90,
    },
    {
      id: "first-strength-log",
      icon: "▲",
      name: "Primera marca de fuerza registrada",
      description: "Guardaste pesos y repeticiones de una clase presencial.",
      unlocked: Boolean(facts.firstStrengthLogDate),
      unlockedAt: facts.firstStrengthLogDate,
      progress: facts.firstStrengthLogDate ? 1 : 0,
      target: 1,
    },
    {
      id: "active-30-days",
      icon: "■",
      name: "30 días activo",
      description: "Cumpliste 30 días desde tu incorporación.",
      unlocked: activeDays >= 30,
      unlockedAt: activeDays >= 30 ? addDays(facts.joinedAt, 30) : "",
      progress: Math.min(activeDays, 30),
      target: 30,
    },
  ];
}
