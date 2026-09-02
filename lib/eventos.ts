import type { CoachEvent, EventAudience, EventStatus, EventType } from "@/types/gestion";
import type { CoachEvent as CoachEventRecord, CoachEventAudience, CoachEventStatus, CoachEventType } from "@prisma/client";

export type EventInput = Omit<CoachEvent, "id" | "createdAt" | "updatedAt">;

const eventTypes: EventType[] = ["evaluacion", "reunion", "competencia", "recordatorio"];
const eventStatuses: EventStatus[] = ["pendiente", "completado"];
const eventAudiences: EventAudience[] = ["todos", "CLASSES", "PERSONALIZED", "MIXED"];
const audienceToDatabase: Record<EventAudience, CoachEventAudience> = { todos: "ALL", CLASSES: "CLASSES", PERSONALIZED: "PERSONALIZED", MIXED: "MIXED" };
const audienceFromDatabase: Record<CoachEventAudience, EventAudience> = { ALL: "todos", CLASSES: "CLASSES", PERSONALIZED: "PERSONALIZED", MIXED: "MIXED" };

const typeToDatabase: Record<EventType, CoachEventType> = {
  evaluacion: "EVALUACION",
  reunion: "REUNION",
  competencia: "COMPETENCIA",
  recordatorio: "RECORDATORIO",
};

const statusToDatabase: Record<EventStatus, CoachEventStatus> = {
  pendiente: "PENDIENTE",
  completado: "COMPLETADO",
};

const typeFromDatabase: Record<CoachEventType, EventType> = {
  EVALUACION: "evaluacion",
  REUNION: "reunion",
  COMPETENCIA: "competencia",
  RECORDATORIO: "recordatorio",
};

const statusFromDatabase: Record<CoachEventStatus, EventStatus> = {
  PENDIENTE: "pendiente",
  COMPLETADO: "completado",
};

export function validateEvent(input: EventInput) {
  if (!input.title?.trim() || !input.date) {
    return "Completá el título y la fecha.";
  }
  if (!eventTypes.includes(input.type)) return "Seleccioná un tipo de evento válido.";
  if (!eventStatuses.includes(input.status)) return "Seleccioná un estado válido.";
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) return "Seleccioná un color válido.";
  if (Number.isNaN(Date.parse(`${input.date}T12:00:00.000Z`))) return "La fecha no es válida.";
  if (input.time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return "La hora no es válida.";
  if (!eventAudiences.includes(input.audience)) return "Seleccioná una audiencia válida.";
  return null;
}

export function eventData(input: EventInput) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    location: input.location?.trim() ?? "",
    date: new Date(`${input.date}T12:00:00.000Z`),
    time: input.time,
    color: input.color.toLowerCase(),
    type: typeToDatabase[input.type],
    status: statusToDatabase[input.status],
    showToStudents: input.showToStudents === true,
    audience: audienceToDatabase[input.audience],
  };
}

export function serializeEvent(record: CoachEventRecord): CoachEvent {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    location: record.location,
    date: record.date.toISOString().slice(0, 10),
    time: record.time,
    color: record.color,
    type: typeFromDatabase[record.type],
    status: statusFromDatabase[record.status],
    showToStudents: record.showToStudents,
    audience: audienceFromDatabase[record.audience],
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
