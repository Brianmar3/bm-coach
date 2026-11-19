import { libraryExerciseReferenceUrl } from "./routine-exercise-media.ts";
import type { BMExercise } from "@/types/exercise-library";
import type { TrainingLibraryBlock } from "@/types/training-library";

type SuggestedDefinition = { name: string; category: string; level: string; icon: string; exercises: string[] };

// Names are resolved against the shipped exercise catalog. A missing exercise is
// never replaced by an invented one.
export const SUGGESTED_BLOCK_DEFINITIONS: SuggestedDefinition[] = [
  { name: "Piernas básico", category: "Fuerza", level: "Inicial", icon: "🦵", exercises: ["Sentadilla goblet con mancuerna", "Peso muerto rumano con mancuernas", "Zancada con mancuerna", "Elevación de gemelos de pie con mancuerna"] },
  { name: "Glúteos", category: "Tren inferior", level: "Intermedio", icon: "🏋", exercises: ["Hip thrust con barra", "Peso muerto rumano con mancuernas", "Abducción de cadera sentado con banda elástica"] },
  { name: "Empuje superior", category: "Tren superior", level: "Intermedio", icon: "🏋", exercises: ["Press de banca con mancuernas", "Press militar en máquina de palanca", "Fondos en banco rodillas flexionado con peso corporal"] },
  { name: "Tirón superior", category: "Tren superior", level: "Intermedio", icon: "💪", exercises: ["Jalón al pecho barra en polea", "Remo sentado en polea", "Curl de bíceps con mancuerna"] },
  { name: "Espalda", category: "Espalda", level: "Intermedio", icon: "💪", exercises: ["Jalón al pecho barra en polea", "Remo sentado en polea", "Remo inclinado con barra"] },
  { name: "Hombros", category: "Hombros", level: "Intermedio", icon: "🏋", exercises: ["Press militar en máquina de palanca", "Elevación lateral en polea", "Elevación lateral full can con mancuerna"] },
  { name: "Core esencial", category: "Core", level: "Inicial", icon: "💪", exercises: ["Dead bug con peso corporal", "Press Pallof horizontal con banda", "Plancha frontal con giro"] },
  { name: "Tren superior completo", category: "Tren superior", level: "Intermedio", icon: "🏋", exercises: ["Press de banca con mancuernas", "Jalón al pecho barra en polea", "Press militar en máquina de palanca", "Remo sentado en polea"] },
  { name: "Tren inferior completo", category: "Tren inferior", level: "Intermedio", icon: "🦵", exercises: ["Sentadilla goblet con mancuerna", "Hip thrust con barra", "Peso muerto rumano con mancuernas", "Elevación de gemelos de pie con mancuerna"] },
  { name: "Full body", category: "Cuerpo completo", level: "Intermedio", icon: "🏃", exercises: ["Sentadilla goblet con mancuerna", "Press de banca con mancuernas", "Remo sentado en polea", "Dead bug con peso corporal"] },
  { name: "Entrada en calor", category: "Activación", level: "Inicial", icon: "🔥", exercises: ["Caminata de manos con peso corporal", "Movilidad de hombros sentado con rodillo", "Puente de glúteos bajo en el suelo con peso corporal"] },
  { name: "Movilidad y activación", category: "Movilidad", level: "Inicial", icon: "🤸", exercises: ["Movilidad de hombros sentado con rodillo", "Abducción de cadera lateral con peso corporal", "Estiramiento posterior de deltoides con peso corporal"] },
];

export type SuggestedTrainingBlock = TrainingLibraryBlock & { category: string; level: string; icon: string };

export function buildSuggestedTrainingBlocks(catalog: BMExercise[]): SuggestedTrainingBlock[] {
  const byName = new Map(catalog.map((exercise) => [exercise.displayNameEs, exercise]));
  return SUGGESTED_BLOCK_DEFINITIONS.map((definition, index) => {
    const mobility = definition.category === "Movilidad" || definition.category === "Activación";
    const type = mobility ? "MOBILITY" as const : "STRENGTH" as const;
    const exercises = definition.exercises.map((name, order) => {
      const match = byName.get(name);
      if (!match) throw new Error(`Ejercicio ausente del catálogo: ${name}`);
      return {
        name: match.displayNameEs, muscleGroup: match.muscleGroupLabelEs, sets: mobility ? 1 : 2,
        repetitions: mobility ? "30 s" : "8-12", weight: null, effortType: "RPE" as const, effortValue: null,
        restSeconds: mobility ? 20 : 60, observations: "", videoUrl: libraryExerciseReferenceUrl(match.id),
        tempo: "", alternativeExercise: "", equipment: match.equipmentLabelEs,
        optional: false, targetType: mobility ? "TIME" as const : "REPS" as const, targetSeconds: mobility ? 30 : null,
        targetRepetitions: "", targetDistance: "", targetSide: "", order: order + 1,
      };
    });
    return {
      id: `suggested:${index + 1}`, name: definition.name, type,
      content: { type, name: definition.name, order: 1, rounds: null,
        durationSeconds: mobility ? 300 : null, workSeconds: null, restSeconds: null,
        restBetweenRoundsSeconds: null, targetRounds: null,
        instructions: "Punto de partida editable. Ajustá volumen, esfuerzo y ejercicios según cada alumno.", exercises },
      folder: null, tags: [definition.category, definition.level], status: "active" as const,
      isFavorite: false, lastUsedAt: "", archivedAt: "", createdAt: "", updatedAt: "",
      category: definition.category, level: definition.level, icon: definition.icon,
    };
  });
}
