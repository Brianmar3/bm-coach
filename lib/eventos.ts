import type { CoachEvent, EventStatus, EventType } from "@/types/gestion";
import type { CoachEvent as CoachEventRecord, CoachEventStatus, CoachEventType } from "@prisma/client";

export type EventInput = Omit<CoachEvent, "id" | "createdAt">;

const eventTypes: EventType[] = ["evaluacion", "reunion", "competencia", "recordatorio"];
const eventStatuses: EventStatus[] = ["pendiente", "completado"];

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
  if (!input.title?.trim() || !input.date || !input.time) {
    return "Completá el título, la fecha y la hora.";
  }
  if (!eventTypes.includes(input.type)) return "Seleccioná un tipo de evento válido.";
  if (!eventStatuses.includes(input.status)) return "Seleccioná un estado válido.";
  if (!/^#[0-9a-f]{6}$/i.test(input.color)) return "Seleccioná un color válido.";
  if (Number.isNaN(Date.parse(`${input.date}T12:00:00.000Z`))) return "La fecha no es válida.";
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) return "La hora no es válida.";
  return null;
}

export function eventData(input: EventInput) {
  return {
    title: input.title.trim(),
    description: input.description?.trim() ?? "",
    date: new Date(`${input.date}T12:00:00.000Z`),
    time: input.time,
    color: input.color.toLowerCase(),
    type: typeToDatabase[input.type],
    status: statusToDatabase[input.status],
  };
}

export function serializeEvent(record: CoachEventRecord): CoachEvent {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    date: record.date.toISOString().slice(0, 10),
    time: record.time,
    color: record.color,
    type: typeFromDatabase[record.type],
    status: statusFromDatabase[record.status],
    createdAt: record.createdAt.toISOString(),
  };
}
