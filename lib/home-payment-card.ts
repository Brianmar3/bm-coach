import type { PaymentAccountStatus } from "@/types/gestion";

type HomePaymentCardCopy = {
  title: string;
  detail: string;
  tone: "current" | "due-soon" | "overdue" | "neutral";
};

function dateKeyDayNumber(value: string) {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function shortDate(value: string) {
  const [, month, day] = value.slice(0, 10).split("-");
  return `${day}/${month}`;
}

function dueCountdown(nextDueDate: string, today: string) {
  const days = Math.round(dateKeyDayNumber(nextDueDate) - dateKeyDayNumber(today));
  if (days > 1) return `Faltan ${days} días`;
  if (days === 1) return "Falta 1 día";
  if (days === 0) return "Vence hoy";
  if (days === -1) return "Venció hace 1 día";
  return `Venció hace ${Math.abs(days)} días`;
}

export function homePaymentCardCopy(status: PaymentAccountStatus, nextDueDate: string, today: string): HomePaymentCardCopy {
  if (status === "SIN_CONFIGURAR" || !nextDueDate) {
    return { title: "Sin configurar", detail: "Consultar con tu entrenador", tone: "neutral" };
  }

  if (status === "VENCIDA") {
    return { title: "Vencida", detail: dueCountdown(nextDueDate, today), tone: "overdue" };
  }

  if (status === "VENCE_PRONTO") {
    const countdown = dueCountdown(nextDueDate, today);
    return countdown === "Vence hoy"
      ? { title: "Vence hoy", detail: shortDate(nextDueDate), tone: "due-soon" }
      : { title: `Vence el ${shortDate(nextDueDate)}`, detail: countdown, tone: "due-soon" };
  }

  if (status === "AL_DIA") {
    return { title: "Al día", detail: `Próximo vencimiento: ${shortDate(nextDueDate)}`, tone: "current" };
  }

  return { title: "Sin pagos", detail: `Vence el ${shortDate(nextDueDate)}`, tone: "neutral" };
}
