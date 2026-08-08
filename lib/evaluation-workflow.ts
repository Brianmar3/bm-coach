import type {
  EvaluationBodyIssueValue, EvaluationDraftInput, EvaluationMeasurementValue,
  EvaluationTestCategory, EvaluationTestValue, EvaluationWorkflow,
} from "../types/evaluation-workflow.ts";

export const EVALUATION_STEPS = [
  "Información general", "Objetivo y experiencia", "Hábitos",
  "Observaciones para entrenar", "Movilidad y control motor",
  "Medidas corporales", "Tests físicos", "Resumen final",
] as const;

export const PRIMARY_GOALS = [
  "Pérdida de grasa", "Ganancia de masa muscular", "Mejora de fuerza",
  "Mejora de resistencia", "Rendimiento deportivo", "Salud general", "Movilidad", "Otro",
] as const;

export const EXPERIENCE_LEVELS = ["Sin experiencia", "Principiante", "Intermedio", "Avanzado", "Otro"] as const;

export const BODY_ZONES = [
  "Cuello", "Hombro derecho", "Hombro izquierdo", "Pecho", "Espalda alta", "Espalda baja",
  "Brazo derecho", "Brazo izquierdo", "Codo derecho", "Codo izquierdo", "Muñeca o mano derecha",
  "Muñeca o mano izquierda", "Abdomen", "Cadera derecha", "Cadera izquierda", "Glúteo derecho",
  "Glúteo izquierdo", "Muslo derecho", "Muslo izquierdo", "Rodilla derecha", "Rodilla izquierda",
  "Pantorrilla derecha", "Pantorrilla izquierda", "Tobillo derecho", "Tobillo izquierdo",
  "Pie derecho", "Pie izquierdo",
] as const;

export const MEASUREMENT_DEFINITIONS = [
  { key: "WEIGHT", label: "Peso", unit: "kg", min: 20, max: 500 },
  { key: "WAIST", label: "Cintura", unit: "cm", min: 10, max: 300 },
  { key: "HIP", label: "Cadera", unit: "cm", min: 10, max: 300 },
  { key: "CHEST", label: "Pecho", unit: "cm", min: 10, max: 300 },
  { key: "ARM", label: "Brazo", unit: "cm", min: 5, max: 100, sides: true },
  { key: "THIGH", label: "Muslo", unit: "cm", min: 10, max: 150, sides: true },
  { key: "CALF", label: "Pantorrilla", unit: "cm", min: 5, max: 100, sides: true },
  { key: "BODY_FAT", label: "Grasa corporal", unit: "%", min: 1, max: 75 },
] as const;

export const TEST_DEFINITIONS: Array<{
  key: string; name: string; category: EvaluationTestCategory; area: string; unit: string; protocol: string; material: string;
}> = [
  { key: "KNEE_TO_WALL", name: "Rodilla a la pared", category: "MOBILITY", area: "Tobillo", unit: "cm", protocol: "Medir derecha e izquierda sin levantar el talón; registrar molestia informada.", material: "Pared y cinta métrica" },
  { key: "DEEP_SQUAT", name: "Sentadilla profunda", category: "MOBILITY", area: "Control global", unit: "", protocol: "Observar profundidad, control, apoyo de pies y compensaciones.", material: "Espacio libre" },
  { key: "HIP_HINGE", name: "Bisagra de cadera", category: "MOBILITY", area: "Cadera", unit: "", protocol: "Observar patrón de cadera y control lumbo-pélvico.", material: "Bastón opcional" },
  { key: "ARM_RAISE", name: "Elevación de brazos", category: "MOBILITY", area: "Hombros", unit: "°", protocol: "Observar rango, simetría y compensaciones.", material: "Pared opcional" },
  { key: "THORACIC_ROTATION", name: "Rotación torácica", category: "MOBILITY", area: "Columna torácica", unit: "°", protocol: "Registrar ambos lados y evitar compensaciones pélvicas.", material: "Cinta para marcar" },
  { key: "FRONT_PLANK_CONTROL", name: "Plancha frontal de control", category: "MOBILITY", area: "Zona media", unit: "", protocol: "Evaluar postura y control; no usar como prueba máxima.", material: "Colchoneta" },
  { key: "SIDE_PLANK_CONTROL", name: "Plancha lateral de control", category: "MOBILITY", area: "Zona media", unit: "", protocol: "Observar postura y control en ambos lados.", material: "Colchoneta" },
  { key: "BIRD_DOG", name: "Bird dog", category: "MOBILITY", area: "Control motor", unit: "", protocol: "Observar estabilidad, coordinación y simetría.", material: "Colchoneta" },
  { key: "CONTROLLED_SQUATS", name: "Sentadillas controladas", category: "PHYSICAL", area: "Fuerza", unit: "rep", protocol: "Registrar repeticiones correctas, técnica, profundidad y adaptación.", material: "Banco opcional" },
  { key: "ADAPTED_PUSHUPS", name: "Flexiones adaptadas", category: "PHYSICAL", area: "Fuerza", unit: "rep", protocol: "Elegir pared, banco, rodillas o estándar y registrar repeticiones correctas.", material: "Pared o banco" },
  { key: "ADAPTED_ROW", name: "Remo o tracción adaptada", category: "PHYSICAL", area: "Fuerza", unit: "rep", protocol: "Registrar variante, implemento, repeticiones y técnica.", material: "Banda o implemento disponible" },
  { key: "FRONT_PLANK", name: "Plancha frontal", category: "PHYSICAL", area: "Zona media", unit: "s", protocol: "Prueba submáxima: registrar tiempo, postura y motivo de finalización.", material: "Colchoneta y cronómetro" },
  { key: "SIDE_PLANK", name: "Plancha lateral", category: "PHYSICAL", area: "Zona media", unit: "s", protocol: "Registrar segundos de ambos lados sin buscar un máximo inseguro.", material: "Colchoneta y cronómetro" },
  { key: "STEP_TEST", name: "Step test", category: "PHYSICAL", area: "Capacidad cardiovascular", unit: "s", protocol: "Registrar altura, duración y frecuencia cardíaca solo si corresponde.", material: "Step y cronómetro" },
  { key: "SINGLE_LEG_BALANCE", name: "Equilibrio unipodal", category: "PHYSICAL", area: "Equilibrio y control", unit: "s", protocol: "Registrar ambos lados y apoyo o asistencia utilizada.", material: "Cronómetro" },
];

export function calculateAgeAtDate(birthDate: string, evaluationDate: string) {
  const birthMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birthDate);
  const evaluationMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(evaluationDate);
  if (!birthMatch || !evaluationMatch) return null;
  const birth = new Date(Date.UTC(Number(birthMatch[1]), Number(birthMatch[2]) - 1, Number(birthMatch[3])));
  const evaluation = new Date(Date.UTC(Number(evaluationMatch[1]), Number(evaluationMatch[2]) - 1, Number(evaluationMatch[3])));
  if (birth.toISOString().slice(0, 10) !== birthDate || evaluation.toISOString().slice(0, 10) !== evaluationDate || birth > evaluation) return null;
  let age = Number(evaluationMatch[1]) - Number(birthMatch[1]);
  if (Number(evaluationMatch[2]) < Number(birthMatch[2]) || (evaluationMatch[2] === birthMatch[2] && Number(evaluationMatch[3]) < Number(birthMatch[3]))) age -= 1;
  return age >= 0 && age <= 120 ? age : null;
}

function hasValue(value: unknown) {
  if (typeof value === "string") return Boolean(value.trim());
  if (typeof value === "number") return Number.isFinite(value) && value > 0;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") return Object.values(value).some(hasValue);
  return false;
}

function blockScore(values: unknown[], completeWhen: boolean) {
  const filled = values.filter(hasValue).length;
  if (!filled) return 0;
  return completeWhen ? 1 : 0.5;
}

export function calculateEvaluationCompletion(evaluation: Pick<EvaluationWorkflow,
  "date" | "weeklyAvailability" | "primaryGoal" | "experienceLevel" | "generalData" | "habits" |
  "trainingObservations" | "trainerNotes" | "bodyIssues" | "measurements" | "testResults" |
  "finalStrengths" | "finalPriorities" | "finalLimitations" | "planningNotes" | "finalComment"
>) {
  const mobility = evaluation.testResults.filter((item) => item.category === "MOBILITY" && item.status !== "NOT_PERFORMED");
  const physical = evaluation.testResults.filter((item) => item.category === "PHYSICAL" && item.status !== "NOT_PERFORMED");
  const scores = [
    blockScore([evaluation.date, evaluation.weeklyAvailability, evaluation.generalData], Boolean(evaluation.date && evaluation.weeklyAvailability)),
    blockScore([evaluation.primaryGoal, evaluation.experienceLevel], Boolean(evaluation.primaryGoal && evaluation.experienceLevel)),
    blockScore([evaluation.habits], Object.keys(evaluation.habits).length >= 3),
    blockScore([evaluation.trainingObservations, evaluation.trainerNotes, evaluation.bodyIssues], Boolean(evaluation.trainerNotes || evaluation.bodyIssues.length)),
    blockScore([mobility], mobility.length >= 2),
    blockScore([evaluation.measurements], evaluation.measurements.length >= 1),
    blockScore([physical], physical.length >= 1),
    blockScore([evaluation.finalStrengths, evaluation.finalPriorities, evaluation.finalLimitations, evaluation.planningNotes, evaluation.finalComment], Boolean(evaluation.finalComment)),
  ];
  return Math.min(100, Math.max(0, Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length * 100)));
}

export function missingEssentialFields(evaluation: Pick<EvaluationWorkflow,
  "date" | "primaryGoal" | "experienceLevel" | "weeklyAvailability" | "finalComment" | "measurements" | "testResults"
>) {
  const missing: string[] = [];
  if (!evaluation.date) missing.push("Fecha de evaluación");
  if (!evaluation.primaryGoal.trim()) missing.push("Objetivo principal");
  if (!evaluation.experienceLevel.trim()) missing.push("Nivel o experiencia");
  if (!evaluation.weeklyAvailability.trim()) missing.push("Disponibilidad semanal");
  if (!evaluation.finalComment.trim()) missing.push("Observación final del entrenador");
  if (!evaluation.measurements.length && !evaluation.testResults.some((item) => item.status !== "NOT_PERFORMED")) missing.push("Al menos una medida corporal o un test realizado");
  return missing;
}

export function validateMeasurement(item: EvaluationMeasurementValue) {
  const definition = MEASUREMENT_DEFINITIONS.find((candidate) => candidate.key === item.measurementType);
  if (!definition) return "Tipo de medida no reconocido.";
  if (!Number.isFinite(item.value) || item.value <= 0) return `${definition.label}: ingresá un valor mayor que cero.`;
  if (item.value < definition.min || item.value > definition.max) return `${definition.label}: el valor debe estar entre ${definition.min} y ${definition.max} ${definition.unit}.`;
  if (item.unit !== definition.unit) return `${definition.label}: la unidad debe ser ${definition.unit}.`;
  if ("sides" in definition && definition.sides && item.side !== "RIGHT" && item.side !== "LEFT") return `${definition.label}: indicá lado derecho o izquierdo.`;
  return null;
}

export function validateEvaluationDraft(input: EvaluationDraftInput) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return "Ingresá una fecha de evaluación válida.";
  const parsedDate = new Date(`${input.date}T12:00:00.000Z`);
  if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== input.date) return "Ingresá una fecha de evaluación válida.";
  if (input.date < "1900-01-01" || input.date > new Date().toISOString().slice(0, 10)) return "La fecha de evaluación debe estar entre 1900 y hoy.";
  if (!Number.isInteger(input.currentStep) || input.currentStep < 1 || input.currentStep > 8) return "El paso actual debe estar entre 1 y 8.";
  const ageSnapshot = input.generalData.ageSnapshot;
  if (ageSnapshot !== null && ageSnapshot !== undefined && (!Number.isInteger(ageSnapshot) || Number(ageSnapshot) < 0 || Number(ageSnapshot) > 120)) return "La edad debe ser un número entero entre 0 y 120.";
  for (const measurement of input.measurements) {
    const error = validateMeasurement(measurement);
    if (error) return error;
  }
  for (const issue of input.bodyIssues) {
    if (!BODY_ZONES.includes(issue.bodyZone as (typeof BODY_ZONES)[number])) return "La zona corporal seleccionada no es válida.";
    if (issue.intensity !== null && (!Number.isInteger(issue.intensity) || issue.intensity < 0 || issue.intensity > 10)) return "La intensidad informada debe estar entre 0 y 10.";
  }
  return null;
}

export function emptyTest(testKey: string, category: EvaluationTestCategory): EvaluationTestValue {
  const definition = TEST_DEFINITIONS.find((item) => item.key === testKey && item.category === category);
  return { testKey, category, status: "NOT_PERFORMED", numericValue: null, unit: definition?.unit ?? "", rightValue: null, leftValue: null, rightUnit: definition?.unit ?? "", leftUnit: definition?.unit ?? "", pain: false, rightPain: false, leftPain: false, protocol: definition?.protocol ?? "", variation: "", observations: "", compensations: "", notPerformedReason: "", rawResult: {} };
}

export function emptyBodyIssue(bodyZone: string): EvaluationBodyIssueValue {
  return { bodyZone, side: bodyZone.toLowerCase().includes("derech") ? "RIGHT" : bodyZone.toLowerCase().includes("izquierd") ? "LEFT" : "CENTER", intensity: null, hasPain: false, status: "NOT_SPECIFIED", studentDescription: "", trainerObservation: "", approximateDate: "" };
}
