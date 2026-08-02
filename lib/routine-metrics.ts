type RoutineMetricExercise = {
  muscleGroup?: string | null;
  sets?: number | null;
};

type RoutineMetricDay = {
  id?: string;
  dayNumber: number;
  name?: string | null;
  exercises: RoutineMetricExercise[];
};

type RoutineMetricInput = {
  days: RoutineMetricDay[];
};

export type MuscleSeriesDistribution = {
  muscleGroup: string;
  series: number;
  percentage: number;
};

const canonicalMuscleGroups: Record<string, string> = {
  abdomen: "Core",
  abdominales: "Core",
  aductor: "Aductores",
  aductores: "Aductores",
  bicep: "Bíceps",
  biceps: "Bíceps",
  core: "Core",
  cuadricep: "Cuádriceps",
  cuadriceps: "Cuádriceps",
  dorsal: "Espalda",
  dorsales: "Espalda",
  espalda: "Espalda",
  gemelo: "Gemelos",
  gemelos: "Gemelos",
  gluteo: "Glúteos",
  gluteos: "Glúteos",
  hombro: "Hombros",
  hombros: "Hombros",
  isquio: "Isquios",
  isquios: "Isquios",
  isquiotibial: "Isquios",
  isquiotibiales: "Isquios",
  pecho: "Pecho",
  tricep: "Tríceps",
  triceps: "Tríceps",
};

function comparable(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("es")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeMuscleGroup(value?: string | null) {
  const trimmed = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!trimmed) return "Sin clasificar";
  return canonicalMuscleGroups[comparable(trimmed)] ?? trimmed;
}

function configuredSeries(value?: number | null) {
  if (!Number.isFinite(value) || !value || value < 1) return 0;
  return Math.floor(value);
}

function distributionFor(exercises: RoutineMetricExercise[]) {
  const grouped = new Map<string, number>();
  for (const exercise of exercises) {
    const series = configuredSeries(exercise.sets);
    const muscleGroup = normalizeMuscleGroup(exercise.muscleGroup);
    grouped.set(muscleGroup, (grouped.get(muscleGroup) ?? 0) + series);
  }
  const total = [...grouped.values()].reduce((sum, series) => sum + series, 0);
  return [...grouped.entries()]
    .map(([muscleGroup, series]) => ({
      muscleGroup,
      series,
      percentage: total ? series / total * 100 : 0,
    }))
    .sort((a, b) => b.series - a.series || a.muscleGroup.localeCompare(b.muscleGroup, "es"));
}

export function routineSeriesMetrics(routine: RoutineMetricInput) {
  const exercises = routine.days.flatMap((day) => day.exercises);
  return {
    totalDays: routine.days.length,
    activeDays: routine.days.filter((day) => day.exercises.length > 0).length,
    totalExercises: exercises.length,
    totalSeries: exercises.reduce((sum, exercise) => sum + configuredSeries(exercise.sets), 0),
    weeklyDistribution: distributionFor(exercises),
    perDay: routine.days.map((day) => ({
      id: day.id ?? String(day.dayNumber),
      dayNumber: day.dayNumber,
      name: day.name?.trim() || `Día ${day.dayNumber}`,
      totalExercises: day.exercises.length,
      totalSeries: day.exercises.reduce((sum, exercise) => sum + configuredSeries(exercise.sets), 0),
      distribution: distributionFor(day.exercises),
    })),
  };
}
