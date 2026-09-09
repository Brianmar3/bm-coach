import type { BMExercise } from "../types/exercise-library.ts";

export type SelfServiceRoutineAnswers = { objective: string; level: "Principiante" | "Intermedio" | "Avanzado"; daysPerWeek: number; sessionMinutes: number; trainingLocation: string; equipment: string[]; priorityMuscle: string; limitations?: string; variation?: number };
export type TrainingPattern = "knee" | "hinge" | "horizontalPush" | "horizontalPull" | "verticalPush" | "verticalPull" | "core" | "calves" | "pushAccessory" | "pullAccessory" | "lowerAccessory" | "gluteAccessory";
export type SelfServiceProposedExercise = { libraryId: string; name: string; muscleGroup: string; equipment: string; pattern: TrainingPattern; sets: number; repetitions: string; restSeconds: number };
export type SelfServiceRoutineProposal = { title: string; summary: string; warning?: string; days: Array<{ dayNumber: number; name: string; exercises: SelfServiceProposedExercise[] }> };
type DayPlan = { name: string; patterns: TrainingPattern[] };

const equipmentMap: Record<string, string[]> = {
  "Peso corporal": ["body weight", "assisted"], Mancuernas: ["dumbbell"], Bandas: ["band", "resistance band"],
  "Barra y discos": ["barbell", "ez barbell", "olympic barbell", "trap bar"], Máquinas: ["cable", "leverage machine", "smith machine", "sled machine"],
  Banco: ["body weight", "dumbbell", "barbell"],
};
const priorityTargets: Record<string, string[]> = { Piernas: ["quads", "hamstrings", "calves"], Glúteos: ["glutes"], Espalda: ["lats", "upper back"], Pecho: ["pectorals"], Hombros: ["delts"], Brazos: ["biceps", "triceps"], Core: ["abs", "obliques"] };
const balancedPlans: Record<number, DayPlan[]> = {
  1: [{ name: "Full body", patterns: ["knee", "horizontalPush", "horizontalPull", "hinge", "core", "calves"] }],
  2: [
    { name: "Full body A", patterns: ["knee", "horizontalPush", "horizontalPull", "hinge", "verticalPull", "core"] },
    { name: "Full body B", patterns: ["hinge", "verticalPush", "verticalPull", "knee", "horizontalPull", "calves"] },
  ],
  3: [
    { name: "Full body A", patterns: ["knee", "horizontalPush", "horizontalPull", "hinge", "core", "calves"] },
    { name: "Full body B", patterns: ["hinge", "verticalPush", "verticalPull", "knee", "pullAccessory", "core"] },
    { name: "Full body C", patterns: ["knee", "horizontalPull", "horizontalPush", "hinge", "verticalPull", "calves"] },
  ],
  4: [
    { name: "Tren superior A", patterns: ["horizontalPush", "horizontalPull", "verticalPush", "verticalPull", "pushAccessory", "core"] },
    { name: "Tren inferior A", patterns: ["knee", "hinge", "lowerAccessory", "gluteAccessory", "calves", "core"] },
    { name: "Tren superior B", patterns: ["verticalPull", "verticalPush", "horizontalPull", "horizontalPush", "pullAccessory", "core"] },
    { name: "Tren inferior B", patterns: ["hinge", "knee", "lowerAccessory", "gluteAccessory", "calves", "core"] },
  ],
  5: [
    { name: "Tren superior", patterns: ["horizontalPush", "horizontalPull", "verticalPush", "verticalPull", "pushAccessory", "core"] },
    { name: "Tren inferior", patterns: ["knee", "hinge", "lowerAccessory", "gluteAccessory", "calves", "core"] },
    { name: "Empuje", patterns: ["horizontalPush", "verticalPush", "horizontalPush", "pushAccessory", "pushAccessory", "core"] },
    { name: "Tirón", patterns: ["verticalPull", "horizontalPull", "horizontalPull", "pullAccessory", "pullAccessory", "core"] },
    { name: "Piernas", patterns: ["knee", "hinge", "lowerAccessory", "gluteAccessory", "calves", "core"] },
  ],
};

const exerciseCount = (minutes: number) => minutes <= 35 ? 4 : minutes <= 50 ? 5 : 6;
const normalized = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function matchesPattern(exercise: BMExercise, pattern: TrainingPattern) {
  const name = normalized(`${exercise.displayNameEs} ${exercise.name}`); const target = exercise.targetMuscle;
  if (pattern === "knee") return target === "quads" && /sentadilla|squat|zancada|lunge|step-up|subida|prensa|extension de pierna/.test(name) && !/estiramiento/.test(name);
  if (pattern === "hinge") return ["hamstrings", "glutes"].includes(target) && /peso muerto|deadlift|rumano|hip thrust|puente|good morning|buenos dias/.test(name);
  if (pattern === "horizontalPush") return target === "pectorals" && /press|flexion|push-up|fondos/.test(name);
  if (pattern === "horizontalPull") return ["upper back", "lats"].includes(target) && /remo|row/.test(name);
  if (pattern === "verticalPush") return target === "delts" && /press|empuje/.test(name);
  if (pattern === "verticalPull") return target === "lats" && /jalon|pulldown|dominada|pull-up/.test(name);
  if (pattern === "core") return ["abs", "obliques"].includes(target);
  if (pattern === "calves") return target === "calves";
  if (pattern === "pushAccessory") return (target === "triceps" && /extension|tiron posterior|pressdown|pushdown/.test(name)) || (target === "delts" && /elevacion lateral/.test(name));
  if (pattern === "pullAccessory") return target === "biceps" && /curl/.test(name);
  if (pattern === "gluteAccessory") return target === "glutes" && /hip thrust|puente|patada|abduccion|gluteo/.test(name);
  return target === "hamstrings" && /curl femoral/.test(name);
}

function suitabilityScore(exercise: BMExercise, pattern: TrainingPattern, level: SelfServiceRoutineAnswers["level"]) {
  const name = normalized(`${exercise.displayNameEs} ${exercise.name}`); let score = 0;
  if (/press de banca|chest press|remo sentado|jalon al pecho|lat pulldown|peso muerto rumano|sentadilla goblet|prensa de pierna|press de hombro|press militar|elevacion de gemelos/.test(name)) score += 20;
  if (/curl de biceps|curl femoral|extension de triceps|extension en polea|hip thrust|puente de gluteos|abdominal bicicleta|sit-up a tres cuartos|toques de talon|crunch|plancha frontal con peso corporal/.test(name)) score += 12;
  if (/barra|mancuerna|maquina|polea|peso corporal/.test(name)) score += 4;
  if (/alternado|unilateral|una pierna|un brazo|lateral/.test(name)) score -= 3;
  if (/sobre la cabeza|cargada|arranque|salto|bosu|pelota de estabilidad|suspendido|gimnastic|equilibrio|power point|toque de hombro|plancha invers|y press de hombro|con press de barra|guillotina|declinado|detras|tras nuca|lanzamiento/.test(name)) score -= level === "Principiante" ? 30 : 8;
  if (["pushAccessory", "pullAccessory", "lowerAccessory", "core", "calves"].includes(pattern)) score += 2;
  return score;
}

function prescription(pattern: TrainingPattern, answers: SelfServiceRoutineAnswers) {
  const accessory = ["core", "calves", "pushAccessory", "pullAccessory", "lowerAccessory", "gluteAccessory"].includes(pattern); const strength = /fuerza/i.test(answers.objective); const conditioning = /bajar grasa|rendimiento/i.test(answers.objective);
  const sets = answers.level === "Avanzado" ? accessory ? 3 : 4 : accessory ? 2 : 3;
  if (strength && !accessory) return { sets, repetitions: "6-8", restSeconds: answers.level === "Principiante" ? 150 : 180 };
  if (accessory) return { sets, repetitions: pattern === "core" ? "10-15" : "12-15", restSeconds: conditioning ? 60 : 75 };
  return { sets, repetitions: "8-12", restSeconds: conditioning ? 90 : 120 };
}

function planFor(answers: SelfServiceRoutineAnswers) {
  const frequency = Math.max(1, Math.min(answers.daysPerWeek, 5)); const count = exerciseCount(answers.sessionMinutes);
  return balancedPlans[frequency].map((day) => {
    const patterns = day.patterns.slice(0, count);
    return { ...day, patterns };
  });
}

export function generateSelfServiceRoutineProposal(answers: SelfServiceRoutineAnswers, library: BMExercise[]): SelfServiceRoutineProposal {
  const allowed = new Set(["body weight", ...answers.equipment.flatMap((item) => equipmentMap[item] ?? [])]);
  const usable = library.filter((item) => item.translationStatus !== "REVIEW" && allowed.has(item.equipment));
  if (!usable.length) throw new Error("EMPTY_EXERCISE_LIBRARY");
  const used = new Set<string>(); const usedNames = new Set<string>(); const priority = priorityTargets[answers.priorityMuscle] ?? []; const variation = Math.max(0, answers.variation ?? 0);
  const days = planFor(answers).map((day, dayIndex) => {
    const exercises = day.patterns.map((pattern) => {
      const alternatives: Partial<Record<TrainingPattern, TrainingPattern[]>> = { verticalPush: ["horizontalPush", "pushAccessory"], verticalPull: ["horizontalPull", "pullAccessory"], horizontalPush: ["verticalPush", "pushAccessory"], horizontalPull: ["verticalPull", "pullAccessory"], lowerAccessory: ["hinge", "knee"], gluteAccessory: ["hinge", "lowerAccessory"], calves: ["lowerAccessory"], pushAccessory: ["horizontalPush"], pullAccessory: ["horizontalPull"] };
      const patternOrder = [pattern, ...(alternatives[pattern] ?? [])];
      const available = (item: BMExercise) => !used.has(item.id) && !usedNames.has(normalized(item.displayNameEs));
      const pool = patternOrder.map((candidatePattern) => usable.filter((item) => matchesPattern(item, candidatePattern) && available(item))).find((items) => items.length) ?? usable.filter(available);
      const candidates = pool.sort((left, right) => suitabilityScore(right, pattern, answers.level) - suitabilityScore(left, pattern, answers.level) || left.id.localeCompare(right.id));
      const selected = candidates[variation % Math.max(1, Math.min(candidates.length, 5))];
      if (!selected) throw new Error(`MISSING_PATTERN:${pattern}`);
      used.add(selected.id); usedNames.add(normalized(selected.displayNameEs));
      const prescribed = prescription(pattern, answers);
      if (priority.includes(selected.targetMuscle) && dayIndex < 2) prescribed.sets += 1;
      return { libraryId: selected.id, name: selected.displayNameEs, muscleGroup: selected.targetMuscleLabelEs, equipment: selected.equipmentLabelEs, pattern, ...prescribed };
    });
    return { dayNumber: dayIndex + 1, name: day.name, exercises };
  });
  return { title: "Tu rutina sugerida", summary: `${days.length} ${days.length === 1 ? "día" : "días"} · ${answers.sessionMinutes} min · ${answers.objective}`, warning: answers.limitations?.trim() ? "Registramos tus molestias o limitaciones. Como la biblioteca no clasifica contraindicaciones clínicas, revisá los ejercicios y evitá cualquiera que te genere dolor." : undefined, days };
}
