export type AchievementCategory = "CONSTANCIA" | "ASISTENCIA" | "FUERZA" | "REPETICIONES" | "VOLUMEN" | "RUTINAS" | "CLASES" | "EVALUACIONES" | "ANTIGUEDAD" | "RECORDS_PERSONALES" | "TIEMPO";
export type AchievementLevel = "COMUN" | "DESTACADO" | "ESPECIAL" | "HITO";

export type PortalAchievement = {
  id: string;
  icon: string;
  name: string;
  description: string;
  unlocked: boolean;
  unlockedAt: string;
  progress: number;
  target: number;
  category?: AchievementCategory;
  level?: AchievementLevel;
  exercise?: string;
  previousValue?: string;
  newValue?: string;
  sessionId?: string;
  source?: "ROUTINE" | "CLASS";
};

type AchievementFacts = {
  completedWorkoutDates: string[];
  attendedClassDates: string[];
  evaluationDates: string[];
  firstStrengthLogDate: string;
  joinedAt: string;
  today: string;
  weeklyGoal: number;
  active: boolean;
  hasRoutine: boolean;
  hasClassParticipation: boolean;
};

const dateTime = (value: string) => Date.parse(`${value.slice(0, 10)}T12:00:00Z`);
const daysBetween = (start: string, end: string) => {
  const difference = dateTime(end) - dateTime(start);
  return Number.isFinite(difference) ? Math.floor(difference / 86400000) : 0;
};
const addDays = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey.slice(0, 10)}T12:00:00Z`);
  if (!Number.isFinite(date.getTime())) return "";
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const weekKey = (value: string) => {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
};

function streakFacts(dates: string[], weeklyGoal: number, today: string) {
  if (!weeklyGoal) return { completedWeeks: [] as string[], best: 0, current: 0, reachedAt: new Map<number, string>() };
  const counts = new Map<string, number>();
  for (const value of dates) counts.set(weekKey(value), (counts.get(weekKey(value)) ?? 0) + 1);
  const completedWeeks = [...counts].filter(([, count]) => count >= weeklyGoal).map(([week]) => week).sort();
  const reachedAt = new Map<number, string>();
  let best = 0; let running = 0; let previous = "";
  for (const week of completedWeeks) {
    running = previous && daysBetween(previous, week) === 7 ? running + 1 : 1;
    best = Math.max(best, running);
    if (!reachedAt.has(running)) reachedAt.set(running, week);
    previous = week;
  }
  const currentWeek = weekKey(today);
  const previousWeek = addDays(currentWeek, -7);
  let current = 0;
  let cursor = completedWeeks.includes(currentWeek) ? currentWeek : completedWeeks.includes(previousWeek) ? previousWeek : "";
  while (cursor && completedWeeks.includes(cursor)) {
    current += 1;
    cursor = addDays(cursor, -7);
  }
  return { completedWeeks, best, current, reachedAt };
}

function milestone(id: string, icon: string, name: string, description: string, dates: string[], target: number, category: AchievementCategory, level: AchievementLevel): PortalAchievement {
  return { id, icon, name, description, unlocked: dates.length >= target, unlockedAt: dates[target - 1] ?? "", progress: Math.min(dates.length, target), target, category, level };
}

export function calculatePortalAchievements(facts: AchievementFacts): PortalAchievement[] {
  const workouts = [...facts.completedWorkoutDates].sort();
  const attendances = [...facts.attendedClassDates].sort();
  const evaluations = [...facts.evaluationDates].sort();
  const weeklyDates = facts.hasClassParticipation ? attendances : workouts;
  const streak = streakFacts(weeklyDates, facts.weeklyGoal, facts.today);
  const achievements: PortalAchievement[] = [];

  if (facts.hasRoutine) {
    for (const [target, name, level] of [[1, "Primer entrenamiento registrado", "COMUN"], [5, "5 entrenamientos completados", "COMUN"], [10, "10 entrenamientos completados", "DESTACADO"], [25, "25 entrenamientos completados", "DESTACADO"], [50, "50 sesiones", "ESPECIAL"]] as const) {
      achievements.push(milestone(`workouts-${target}`, "◆", name, target === 1 ? "Finalizaste tu primera sesión válida." : `Completaste ${target} entrenamientos.`, workouts, target, "RUTINAS", level));
    }
  }
  if (facts.hasClassParticipation) {
    for (const [target, name, level] of [[1, "Primera clase", "COMUN"], [5, "5 clases completadas", "COMUN"], [10, "10 clases completadas", "DESTACADO"], [25, "25 clases completadas", "DESTACADO"], [50, "Disciplina sostenida", "ESPECIAL"], [100, "Centenario: 100 asistencias", "HITO"], [200, "200 clases completadas", "HITO"]] as const) {
      achievements.push(milestone(`classes-${target}`, "●", name, target === 1 ? "Registraste tu primera asistencia real." : `Alcanzaste ${target} asistencias reales.`, attendances, target, "ASISTENCIA", level));
    }
  }
  if (weeklyDates.length && facts.weeklyGoal > 0) {
    achievements.push(milestone("complete-week-1", "■", "Completaste tu objetivo semanal", `Cumpliste el objetivo configurado de ${facts.weeklyGoal} días.`, streak.completedWeeks, 1, "CONSTANCIA", "COMUN"));
    for (const [target, name, level] of [[2, "2 semanas cumpliendo el objetivo", "DESTACADO"], [4, "4 semanas consecutivas", "DESTACADO"], [8, "8 semanas consecutivas", "ESPECIAL"], [12, "12 semanas consecutivas", "ESPECIAL"], [26, "6 meses de constancia", "HITO"]] as const) {
      achievements.push({ id: `streak-${target}`, icon: "■", name, description: `Tu mejor racha alcanzó ${target} semanas cumpliendo el objetivo.`, unlocked: streak.best >= target, unlockedAt: streak.best >= target ? streak.reachedAt.get(target) ?? "" : "", progress: Math.min(streak.best, target), target, category: "CONSTANCIA", level });
    }
  }
  achievements.push(milestone("evaluation-1", "◇", "Primera evaluación", "Nuevo control registrado.", evaluations, 1, "EVALUACIONES", "COMUN"));
  achievements.push(milestone("evaluation-2", "◇", "Primera comparación", "Ya podés comparar tu evolución.", evaluations, 2, "EVALUACIONES", "COMUN"));
  achievements.push(milestone("evaluation-3", "◇", "Tres evaluaciones", "Completaste tres controles corporales.", evaluations, 3, "EVALUACIONES", "DESTACADO"));
  achievements.push(milestone("evaluation-6", "◇", "Seis evaluaciones", "Construiste un seguimiento corporal sostenido.", evaluations, 6, "EVALUACIONES", "ESPECIAL"));
  const evaluationSpan = evaluations.length > 1 ? daysBetween(evaluations[0], evaluations.at(-1) ?? "") : 0;
  achievements.push({ id: "evaluation-year", icon: "◇", name: "Un año de seguimiento corporal", description: "Tus evaluaciones abarcan un año de seguimiento.", unlocked: evaluationSpan >= 365, unlockedAt: evaluationSpan >= 365 ? evaluations.at(-1) ?? "" : "", progress: Math.min(evaluationSpan, 365), target: 365, category: "EVALUACIONES", level: "HITO" });
  achievements.push({ id: "first-strength-log", icon: "▲", name: "Primera marca de fuerza", description: "Registraste una marca válida en una clase presencial.", unlocked: Boolean(facts.firstStrengthLogDate), unlockedAt: facts.firstStrengthLogDate, progress: facts.firstStrengthLogDate ? 1 : 0, target: 1, category: "FUERZA", level: "COMUN" });

  const seniorityDays = facts.active && facts.joinedAt ? Math.max(0, daysBetween(facts.joinedAt, facts.today)) : 0;
  for (const [days, name, level] of [[30, "Primer mes en BM Training", "COMUN"], [90, "3 meses entrenando", "DESTACADO"], [183, "6 meses entrenando", "ESPECIAL"], [365, "1 año entrenando", "HITO"], [730, "2 años entrenando", "HITO"]] as const) {
    achievements.push({ id: `seniority-${days}`, icon: "◈", name, description: "Antigüedad calculada desde tu fecha individual de ingreso.", unlocked: seniorityDays >= days, unlockedAt: seniorityDays >= days ? addDays(facts.joinedAt, days) : "", progress: Math.min(seniorityDays, days), target: days, category: "ANTIGUEDAD", level });
  }
  return achievements;
}
