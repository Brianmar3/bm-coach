export type TrainerCommandCategory = "Acciones" | "Navegación";

export type TrainerCommand = {
  id: string;
  label: string;
  href: string;
  symbol: string;
  category: TrainerCommandCategory;
  keywords: string[];
  shortcut?: string;
  mobile?: boolean;
};

export const trainerCommands: TrainerCommand[] = [
  { id: "new-student", label: "Nuevo alumno", href: "/alumnos?accion=nuevo", symbol: "+", category: "Acciones", keywords: ["crear", "alta", "nuevo alumno"], shortcut: "N", mobile: true },
  { id: "payment", label: "Registrar pago", href: "/pagos?accion=nuevo", symbol: "$", category: "Acciones", keywords: ["cobro", "cuota", "pagar"], shortcut: "P", mobile: true },
  { id: "attendance", label: "Tomar asistencia", href: "/asistencias", symbol: "✓", category: "Acciones", keywords: ["presente", "ausente", "clase"], shortcut: "A", mobile: true },
  { id: "new-class", label: "Crear clase", href: "/clases?accion=nueva", symbol: "C", category: "Acciones", keywords: ["horario", "agenda", "nueva clase"], shortcut: "C", mobile: true },
  { id: "evaluation", label: "Nueva evaluación", href: "/evaluaciones", symbol: "E", category: "Acciones", keywords: ["evaluar", "mediciones", "ficha"], shortcut: "E", mobile: true },
  { id: "event", label: "Agregar evento", href: "/eventos", symbol: "●", category: "Acciones", keywords: ["recordatorio", "agenda"], mobile: true },
  { id: "students", label: "Ir a Alumnos", href: "/alumnos", symbol: "A", category: "Navegación", keywords: ["alumnos", "personas"] },
  { id: "classes", label: "Ir a Clases", href: "/clases", symbol: "C", category: "Navegación", keywords: ["clases", "agenda"] },
  { id: "payments", label: "Ir a Pagos", href: "/pagos", symbol: "$", category: "Navegación", keywords: ["pagos", "cobros", "cuotas"] },
  { id: "routines", label: "Ir a Rutinas", href: "/rutinas", symbol: "R", category: "Navegación", keywords: ["rutinas", "planes", "entrenamiento"], shortcut: "R" },
  { id: "evaluations", label: "Ir a Evaluaciones", href: "/evaluaciones", symbol: "E", category: "Navegación", keywords: ["evaluaciones", "progreso"] },
];

export const quickAddCommands = trainerCommands.filter((command) => command.mobile);

export function normalizeCommandQuery(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es").trim();
}

export function filterTrainerCommands(query: string, limit = 8) {
  const normalized = normalizeCommandQuery(query);
  if (!normalized) return trainerCommands.filter((command) => command.category === "Acciones").slice(0, 6);
  return trainerCommands.filter((command) => normalizeCommandQuery([command.label, ...command.keywords].join(" ")).includes(normalized)).slice(0, limit);
}

export function shouldIgnoreGlobalShortcut(target: EventTarget | null) {
  if (!target || typeof target !== "object") return false;
  const element = target as { isContentEditable?: boolean; tagName?: string };
  return Boolean(element.isContentEditable) || ["INPUT", "TEXTAREA", "SELECT"].includes(element.tagName?.toUpperCase() ?? "");
}

export function nextCommandIndex(current: number, key: string, length: number) {
  if (!length) return -1;
  if (key === "ArrowDown") return (current + 1 + length) % length;
  if (key === "ArrowUp") return (current - 1 + length) % length;
  return current;
}

export type StudentCommandIntent = "student" | "payment" | "attendance" | "routine" | "evaluation";

export function studentCommandIntent(query: string): StudentCommandIntent {
  const value = normalizeCommandQuery(query);
  if (/\b(pago|pagar|cobro|cuota)\b/.test(value)) return "payment";
  if (/\b(asistencia|presente|ausente)\b/.test(value)) return "attendance";
  if (/\b(rutina|plan|entrenamiento)\b/.test(value)) return "routine";
  if (/\b(evaluar|evaluacion|medicion)\b/.test(value)) return "evaluation";
  return "student";
}

export function studentSearchTerms(query: string) {
  return normalizeCommandQuery(query).replace(/\b(pago|pagar|cobro|cuota|asistencia|presente|ausente|rutina|plan|entrenamiento|evaluar|evaluacion|medicion|alumno|abrir)\b/g, " ").replace(/\s+/g, " ").trim();
}
