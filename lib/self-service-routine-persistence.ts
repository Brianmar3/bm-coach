import type { BMExercise } from "../types/exercise-library.ts";
import type { RoutineInput } from "./rutinas.ts";
import type { SelfServiceRoutineAnswers, SelfServiceRoutineProposal } from "./self-service-routine-proposal.ts";
import { EQUIPMENT_OPTIONS, SELF_SERVICE_GOALS, TRAINING_LOCATIONS } from "./self-service.ts";

const levelMap = { Principiante: "principiante", Intermedio: "intermedio", Avanzado: "avanzado" } as const;
const priorities = ["", "Piernas", "Glúteos", "Espalda", "Pecho", "Hombros", "Brazos", "Core"];

export function validSelfServiceRoutineAnswers(value: unknown): value is SelfServiceRoutineAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const input = value as Record<string, unknown>;
  return typeof input.objective === "string" && (SELF_SERVICE_GOALS as readonly string[]).includes(input.objective)
    && typeof input.level === "string" && input.level in levelMap
    && typeof input.daysPerWeek === "number" && Number.isInteger(input.daysPerWeek) && input.daysPerWeek >= 1 && input.daysPerWeek <= 5
    && typeof input.sessionMinutes === "number" && Number.isInteger(input.sessionMinutes) && input.sessionMinutes >= 20 && input.sessionMinutes <= 120
    && typeof input.trainingLocation === "string" && (TRAINING_LOCATIONS as readonly string[]).includes(input.trainingLocation)
    && Array.isArray(input.equipment) && input.equipment.length > 0 && input.equipment.every((item) => typeof item === "string" && (EQUIPMENT_OPTIONS as readonly string[]).includes(item))
    && typeof input.priorityMuscle === "string" && priorities.includes(input.priorityMuscle)
    && (input.variation === undefined || typeof input.variation === "number" && Number.isInteger(input.variation) && input.variation >= 0 && input.variation <= 100);
}

export function selfServiceProposalError(proposal: SelfServiceRoutineProposal) {
  if (!proposal || !Array.isArray(proposal.days) || proposal.days.length < 1 || proposal.days.length > 5) return "La propuesta debe incluir entre 1 y 5 días.";
  if (proposal.days.some((day, index) => day.dayNumber !== index + 1 || !day.name.trim() || !day.exercises.length)) return "Los días de la propuesta no son válidos.";
  for (const exercise of proposal.days.flatMap((day) => day.exercises)) {
    if (!exercise.libraryId?.trim()) return "Uno de los ejercicios no pertenece a la Biblioteca BM.";
    if (!Number.isInteger(exercise.sets) || exercise.sets < 1 || exercise.sets > 10) return "Las series deben ser un entero entre 1 y 10.";
    const repetitions = exercise.repetitions?.match(/\d+/g)?.map(Number) ?? [];
    if (!/^\d+\s*(?:[-–]\s*\d+)?$/.test(exercise.repetitions.trim()) || repetitions.some((value) => value < 1 || value > 100)) return "Las repeticiones deben ser un valor o rango entre 1 y 100.";
    if (!Number.isInteger(exercise.restSeconds) || exercise.restSeconds < 0 || exercise.restSeconds > 600) return "El descanso debe estar entre 0 y 600 segundos.";
  }
  return null;
}

export function selfServiceRoutineInput(studentId: string, answers: SelfServiceRoutineAnswers, proposal: SelfServiceRoutineProposal, library: BMExercise[], startDate: string): RoutineInput {
  const proposalError = selfServiceProposalError(proposal);
  if (proposalError) throw new Error(proposalError);
  const exercises = new Map(library.map((exercise) => [exercise.id, exercise]));
  const missing = proposal.days.flatMap((day) => day.exercises).find((exercise) => !exercises.has(exercise.libraryId));
  if (missing) throw new Error("Uno de los ejercicios ya no está disponible en la Biblioteca BM.");
  return {
    name: `Mi rutina · ${answers.objective}`,
    kind: "assigned",
    description: "Rutina creada desde Mi cuenta.",
    objective: answers.objective,
    level: levelMap[answers.level],
    status: "activa",
    startDate,
    durationWeeks: null,
    priorityMuscles: answers.priorityMuscle ? [answers.priorityMuscle] : [],
    location: answers.trainingLocation,
    equipment: [...answers.equipment],
    tags: ["SELF_SERVICE_OWNED"],
    studentIds: [studentId],
    days: proposal.days.map((day) => ({
      dayNumber: day.dayNumber,
      name: day.name,
      objective: answers.objective,
      warmup: "",
      observations: "",
      estimatedMinutes: answers.sessionMinutes,
      exercises: [],
      blocks: [{
        type: "STRENGTH",
        name: "Entrenamiento principal",
        order: 1,
        rounds: null,
        durationSeconds: null,
        workSeconds: null,
        restSeconds: null,
        restBetweenRoundsSeconds: null,
        targetRounds: null,
        instructions: "",
        exercises: day.exercises.map((exercise, index) => {
          const source = exercises.get(exercise.libraryId)!;
          return {
            name: source.displayNameEs,
            muscleGroup: source.targetMuscleLabelEs,
            sets: exercise.sets,
            repetitions: exercise.repetitions.trim().replaceAll("–", "-"),
            weight: null,
            effortType: "RIR",
            effortValue: null,
            restSeconds: exercise.restSeconds,
            observations: "",
            videoUrl: "",
            tempo: "",
            alternativeExercise: "",
            equipment: source.equipmentLabelEs,
            optional: false,
            targetType: "REPS",
            targetSeconds: null,
            targetRepetitions: "",
            targetDistance: "",
            targetSide: "",
            order: index + 1,
          };
        }),
      }],
    })),
  };
}
