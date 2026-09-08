import type { BMExercise } from "@/types/exercise-library";

export type SelfServiceRoutineAnswers = {
  objective: string;
  level: "Principiante" | "Intermedio" | "Avanzado";
  daysPerWeek: number;
  sessionMinutes: number;
  trainingLocation: string;
  equipment: string[];
  priorityMuscle: string;
  variation?: number;
};

export type SelfServiceProposedExercise = {
  libraryId: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  sets: number;
  repetitions: string;
  restSeconds: number;
};

export type SelfServiceRoutineProposal = {
  title: string;
  summary: string;
  days: Array<{ dayNumber: number; name: string; exercises: SelfServiceProposedExercise[] }>;
};

const equipmentMap: Record<string, string[]> = {
  "Peso corporal": ["body weight", "assisted"],
  Mancuernas: ["dumbbell"],
  Bandas: ["band", "resistance band"],
  "Barra y discos": ["barbell", "ez barbell", "olympic barbell", "trap bar"],
  Máquinas: ["cable", "leverage machine", "smith machine", "sled machine"],
  Banco: ["body weight", "dumbbell", "barbell"],
};

const patterns: Record<string, string[]> = {
  knee: ["quads", "glutes"],
  hinge: ["hamstrings", "glutes"],
  push: ["pectorals", "delts", "triceps"],
  pull: ["lats", "upper back", "biceps"],
  core: ["abs", "obliques"],
  lower: ["quads", "hamstrings", "glutes", "calves"],
  upper: ["pectorals", "lats", "delts", "upper back"],
};
const priorityTargets: Record<string, string[]> = {
  Piernas: ["quads", "hamstrings", "calves"], Glúteos: ["glutes"], Espalda: ["lats", "upper back"],
  Pecho: ["pectorals"], Hombros: ["delts"], Brazos: ["biceps", "triceps"], Core: ["abs", "obliques"],
};

const dayPatterns = (frequency: number) => {
  if (frequency <= 3) return Array.from({ length: frequency }, (_, index) => ({ name: `Full body ${index + 1}`, patterns: ["knee", "hinge", "push", "pull", "core"] }));
  if (frequency === 4) return [
    { name: "Tren superior A", patterns: ["push", "pull", "upper", "push", "core"] },
    { name: "Tren inferior A", patterns: ["knee", "hinge", "lower", "knee", "core"] },
    { name: "Tren superior B", patterns: ["pull", "push", "upper", "pull", "core"] },
    { name: "Tren inferior B", patterns: ["hinge", "knee", "lower", "hinge", "core"] },
  ];
  return [
    { name: "Empuje", patterns: ["push", "push", "upper", "core", "push"] },
    { name: "Tirón", patterns: ["pull", "pull", "upper", "core", "pull"] },
    { name: "Piernas", patterns: ["knee", "hinge", "lower", "knee", "core"] },
    { name: "Tren superior", patterns: ["push", "pull", "upper", "push", "core"] },
    { name: "Full body", patterns: ["knee", "hinge", "push", "pull", "core"] },
  ].slice(0, Math.min(frequency, 5));
};

function exerciseCount(minutes: number) {
  return minutes <= 35 ? 4 : minutes <= 55 ? 5 : 6;
}

function prescription(level: SelfServiceRoutineAnswers["level"], objective: string) {
  const strength = /fuerza/i.test(objective);
  if (level === "Principiante") return { sets: 3, repetitions: strength ? "6-8" : "8-12", restSeconds: strength ? 120 : 90 };
  if (level === "Avanzado") return { sets: 4, repetitions: strength ? "4-6" : "8-12", restSeconds: strength ? 150 : 90 };
  return { sets: strength ? 4 : 3, repetitions: strength ? "5-8" : "8-12", restSeconds: strength ? 120 : 90 };
}

export function generateSelfServiceRoutineProposal(answers: SelfServiceRoutineAnswers, library: BMExercise[]): SelfServiceRoutineProposal {
  const allowed = new Set(["body weight", ...answers.equipment.flatMap((item) => equipmentMap[item] ?? [])]);
  const usable = library.filter((item) => item.translationStatus !== "REVIEW" && allowed.has(item.equipment));
  const used = new Set<string>();
  const variation = Math.max(0, answers.variation ?? 0);
  const count = exerciseCount(answers.sessionMinutes);
  const prescribed = prescriptionFor(answers, prescription(answers.level, answers.objective));
  const structure = dayPatterns(Math.max(1, Math.min(answers.daysPerWeek, 5)));
  const days = structure.map((day, dayIndex) => {
    const requested = [...day.patterns];
    while (requested.length < count) requested.push(dayIndex % 2 ? "upper" : "lower");
    const exercises = requested.slice(0, count).map((pattern, exerciseIndex) => {
      const targets = patterns[pattern] ?? patterns.core;
      const preferredTargets = priorityTargets[answers.priorityMuscle] ?? [];
      const matching = usable.filter((item) => targets.includes(item.targetMuscle) && !used.has(item.id));
      const focused = matching.filter((item) => preferredTargets.includes(item.targetMuscle));
      const candidates = focused.length ? focused : matching;
      const fallback = usable.filter((item) => !used.has(item.id));
      const pool = candidates.length ? candidates : fallback.length ? fallback : library;
      const selected = pool[(variation + dayIndex * count + exerciseIndex) % Math.max(pool.length, 1)];
      if (!selected) throw new Error("EMPTY_EXERCISE_LIBRARY");
      used.add(selected.id);
      return { libraryId: selected.id, name: selected.displayNameEs, muscleGroup: selected.targetMuscleLabelEs, equipment: selected.equipmentLabelEs, ...prescribed };
    });
    return { dayNumber: dayIndex + 1, name: day.name, exercises };
  });
  return { title: "Tu rutina sugerida", summary: `${days.length} ${days.length === 1 ? "día" : "días"} · ${answers.sessionMinutes} min · ${answers.objective}`, days };
}

function prescriptionFor(answers: SelfServiceRoutineAnswers, base: { sets: number; repetitions: string; restSeconds: number }) {
  if (/bajar grasa|rendimiento/i.test(answers.objective)) return { ...base, restSeconds: Math.min(base.restSeconds, 75) };
  return base;
}
