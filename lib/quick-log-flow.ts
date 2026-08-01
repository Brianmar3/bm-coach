export type QuickLogKind = "strength" | "time" | "rounds" | "amrap" | "emom" | "cardio" | "intervals" | "note";

export type QuickLogDraft = {
  kind: QuickLogKind | null;
  exercise: string;
  weight: string;
  repetitions: string;
  sets: string;
  effortType: "RIR" | "RPE";
  effort: string;
  restSeconds: string;
  note: string;
  title: string;
  finalTime: string;
  rounds: string;
  extraRepetitions: string;
  durationMinutes: string;
  completedMinutes: string;
  activity: string;
  distance: string;
  workSeconds: string;
  circuitExercises: string;
};

export type ExerciseSuggestion = {
  name: string;
  muscleGroup?: string | null;
  recent?: boolean;
  count?: number;
  lastUsedAt?: string;
};

export const EMPTY_QUICK_LOG_DRAFT: QuickLogDraft = {
  kind: null,
  exercise: "",
  weight: "",
  repetitions: "",
  sets: "",
  effortType: "RPE",
  effort: "",
  restSeconds: "",
  note: "",
  title: "",
  finalTime: "",
  rounds: "",
  extraRepetitions: "",
  durationMinutes: "",
  completedMinutes: "",
  activity: "",
  distance: "",
  workSeconds: "",
  circuitExercises: "",
};

export function normalizeExerciseSearch(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("es");
}

export function exerciseSuggestions(options: ExerciseSuggestion[], query: string, limit = 6) {
  const normalized = normalizeExerciseSearch(query);
  if (!normalized) return options.filter((option) => option.recent).slice(0, limit);
  return options
    .filter((option) => normalizeExerciseSearch(option.name).includes(normalized))
    .sort((left, right) => {
      const leftName = normalizeExerciseSearch(left.name);
      const rightName = normalizeExerciseSearch(right.name);
      return Number(Boolean(right.recent)) - Number(Boolean(left.recent)) ||
        Number(rightName.startsWith(normalized)) - Number(leftName.startsWith(normalized)) ||
        (right.count ?? 0) - (left.count ?? 0) ||
        (right.lastUsedAt ?? "").localeCompare(left.lastUsedAt ?? "") ||
        left.name.localeCompare(right.name, "es");
    })
    .slice(0, limit);
}

function positiveInteger(value: string) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0;
}

export function clockToSeconds(value: string) {
  const parts = value.trim().split(":").map(Number);
  if ((parts.length !== 2 && parts.length !== 3) || parts.some((part) => !Number.isInteger(part) || part < 0)) return null;
  const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
  if (minutes > 59 || seconds > 59) return null;
  const total = hours * 3600 + minutes * 60 + seconds;
  return total > 0 ? total : null;
}

export function secondsToClock(value: number | null) {
  if (value === null || !Number.isFinite(value) || value < 0) return "";
  const total = Math.round(value);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function validateQuickLogDraft(draft: QuickLogDraft) {
  const errors: Partial<Record<keyof QuickLogDraft, string>> = {};
  if (!draft.kind) errors.kind = "Elegí una opción.";
  if (draft.kind === "strength") {
    if (!draft.exercise.trim()) errors.exercise = "Elegí o escribí un ejercicio.";
    if (!positiveInteger(draft.repetitions)) errors.repetitions = "Ingresá repeticiones válidas.";
    if (!positiveInteger(draft.sets)) errors.sets = "Ingresá series válidas.";
    if (draft.weight.trim() && (!Number.isFinite(Number(draft.weight.replace(",", "."))) || Number(draft.weight.replace(",", ".")) < 0)) errors.weight = "Ingresá un peso válido.";
  }
  if (draft.kind === "time") {
    if (!draft.title.trim()) errors.title = "Ingresá el nombre del circuito.";
    if (clockToSeconds(draft.finalTime) === null) errors.finalTime = "Ingresá el tiempo.";
  }
  if (["rounds", "amrap"].includes(draft.kind ?? "")) {
    if (!draft.title.trim()) errors.title = "Ingresá el nombre del circuito.";
    if (!positiveInteger(draft.rounds)) errors.rounds = "Ingresá las vueltas.";
  }
  if (["amrap", "emom"].includes(draft.kind ?? "") && !positiveInteger(draft.durationMinutes)) errors.durationMinutes = "Ingresá la duración.";
  if (draft.kind === "emom" && (!positiveInteger(draft.completedMinutes) || Number(draft.completedMinutes) > Number(draft.durationMinutes))) errors.completedMinutes = "Ingresá los minutos completados.";
  if (draft.kind === "cardio") {
    if (!draft.activity.trim()) errors.activity = "Ingresá la actividad.";
    if (!positiveInteger(draft.durationMinutes)) errors.durationMinutes = "Ingresá la duración.";
  }
  if (draft.kind === "intervals") {
    if (!draft.activity.trim()) errors.activity = "Ingresá la actividad.";
    if (!positiveInteger(draft.rounds)) errors.rounds = "Ingresá las rondas.";
    if (!positiveInteger(draft.workSeconds)) errors.workSeconds = "Ingresá el tiempo de trabajo.";
    if (!positiveInteger(draft.restSeconds)) errors.restSeconds = "Ingresá el descanso.";
  }
  if (draft.kind === "note" && !draft.note.trim()) errors.note = "Escribí qué querés anotar.";
  return errors;
}

function advancedStrengthNote(draft: QuickLogDraft) {
  return [
    draft.effort ? `${draft.effortType} ${draft.effort}` : "",
    draft.restSeconds ? `Descanso: ${draft.restSeconds} s` : "",
    draft.note.trim(),
  ].filter(Boolean).join(" · ");
}

export function quickLogPayload(draft: QuickLogDraft, date: string) {
  const base: Record<string, string> = {
    date,
    title: draft.title.trim(),
    content: draft.note.trim(),
    category: draft.kind ?? "",
    durationMinutes: "",
    exerciseName: "",
    sets: "",
    repetitions: "",
    metricType: "",
    previousValue: "",
    currentValue: "",
    unit: "",
    mood: "",
  };
  switch (draft.kind) {
    case "strength": return { ...base, type: "PROGRESS", title: draft.exercise.trim(), exerciseName: draft.exercise.trim(), sets: draft.sets, repetitions: draft.repetitions, metricType: "carga", currentValue: draft.weight.replace(",", "."), unit: "kg", content: advancedStrengthNote(draft) };
    case "time": return { ...base, type: "WORKOUT", metricType: "for_time", currentValue: String(clockToSeconds(draft.finalTime) ?? ""), unit: "segundos", content: [draft.note.trim(), draft.circuitExercises.trim()].filter(Boolean).join(" · ") };
    case "rounds": return { ...base, type: "WORKOUT", metricType: "rounds", sets: draft.rounds, repetitions: draft.extraRepetitions, durationMinutes: draft.durationMinutes, content: [draft.note.trim(), draft.circuitExercises.trim()].filter(Boolean).join(" · ") };
    case "amrap": return { ...base, type: "WORKOUT", metricType: "amrap", sets: draft.rounds, repetitions: draft.extraRepetitions, durationMinutes: draft.durationMinutes, content: draft.circuitExercises.trim() };
    case "emom": return { ...base, type: "WORKOUT", metricType: "emom", sets: draft.completedMinutes, durationMinutes: draft.durationMinutes, content: draft.circuitExercises.trim() };
    case "cardio": return { ...base, type: "WORKOUT", title: draft.activity.trim(), exerciseName: draft.activity.trim(), metricType: "cardio", durationMinutes: draft.durationMinutes, currentValue: draft.distance.replace(",", "."), unit: "km" };
    case "intervals": return { ...base, type: "WORKOUT", title: draft.activity.trim(), exerciseName: draft.activity.trim(), metricType: "intervals", sets: draft.rounds, currentValue: draft.workSeconds, previousValue: draft.restSeconds, unit: "segundos" };
    case "note": return { ...base, type: "NOTE", metricType: "free_note", content: draft.note.trim() };
    default: return base;
  }
}

type SummaryLog = {
  type: string; title: string; content: string; category: string; metricType: string; exerciseName: string;
  sets: number | null; repetitions: number | null; durationMinutes: number | null; currentValue: number | null; previousValue: number | null; unit: string;
};

export function quickLogSummary(log: SummaryLog) {
  const name = log.exerciseName || log.title || "Registro";
  if (log.metricType === "carga" && log.sets !== null && log.repetitions !== null) return `${name} · ${log.sets} × ${log.repetitions}${log.currentValue === null ? "" : ` · ${log.currentValue.toLocaleString("es-AR")} ${log.unit || "kg"}`}`;
  if (log.metricType === "for_time") return `${log.title || "Circuito"} · ${secondsToClock(log.currentValue) || "Sin tiempo"}`;
  if (log.metricType === "rounds") return `${log.title || "Circuito"} · ${log.sets ?? 0} vueltas${log.repetitions ? ` + ${log.repetitions} repeticiones` : ""}`;
  if (log.metricType === "amrap") return `AMRAP ${log.durationMinutes ?? 0} min · ${log.sets ?? 0} vueltas${log.repetitions ? ` + ${log.repetitions}` : ""}`;
  if (log.metricType === "emom") return `EMOM ${log.durationMinutes ?? 0} min · ${log.sets ?? 0}/${log.durationMinutes ?? 0} completados`;
  if (log.metricType === "cardio") return `${name} · ${log.durationMinutes ?? 0} min${log.currentValue === null ? "" : ` · ${log.currentValue.toLocaleString("es-AR")} ${log.unit || "km"}`}`;
  if (log.metricType === "intervals") return `${name} · ${log.sets ?? 0} rondas · ${log.currentValue ?? 0}s / ${log.previousValue ?? 0}s`;
  if (log.metricType === "free_note") return log.content;
  return log.title || log.exerciseName || log.content || log.category || "Registro";
}
