import { isDateKey } from "./payment-dates.ts";

export type ServiceExpirationReminderKind = "THREE_DAYS" | "DUE_TODAY";

function utcDayNumber(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function serviceExpirationReminderKind(
  dueDate: string,
  today: string,
): ServiceExpirationReminderKind | null {
  if (!isDateKey(dueDate) || !isDateKey(today)) return null;
  const days = utcDayNumber(dueDate) - utcDayNumber(today);
  if (days === 3) return "THREE_DAYS";
  if (days === 0) return "DUE_TODAY";
  return null;
}

export function serviceExpirationEventKey(
  studentId: string,
  dueDate: string,
  kind: ServiceExpirationReminderKind,
) {
  return `service-expiration:${studentId}:${dueDate}:${kind}`;
}

export function serviceExpirationContent(
  dueDate: string,
  kind: ServiceExpirationReminderKind,
) {
  if (kind === "DUE_TODAY") {
    return {
      title: "Tu plan vence hoy",
      message: "Contactá a tu entrenador para mantener tu servicio activo.",
    };
  }
  const [year, month, day] = dueDate.split("-");
  return {
    title: "Tu plan está por vencer",
    message: `Tu servicio en BM Training vence el ${day}/${month}/${year}. Consultá con tu entrenador para renovarlo.`,
  };
}

export function serviceExpirationCandidate(input: {
  studentId: string;
  status?: string;
  dueDate?: string;
  hasNativePushDevice: boolean;
  today: string;
}) {
  if (
    input.status !== "activo" ||
    !input.hasNativePushDevice ||
    !input.dueDate
  ) {
    return null;
  }
  const kind = serviceExpirationReminderKind(input.dueDate, input.today);
  if (!kind) return null;
  return {
    studentId: input.studentId,
    dueDate: input.dueDate,
    kind,
    eventKey: serviceExpirationEventKey(input.studentId, input.dueDate, kind),
    ...serviceExpirationContent(input.dueDate, kind),
  };
}
