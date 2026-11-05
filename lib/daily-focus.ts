export const DAILY_FOCUS_TIME_ZONE = "America/Argentina/Buenos_Aires";

export type DailyFocusMessage = { title: string };
export const DAILY_FOCUS_MESSAGES: readonly DailyFocusMessage[] = [
  {
    "title": "Cada entrenamiento cuenta."
  },
  {
    "title": "Hoy también se progresa."
  },
  {
    "title": "La constancia construye resultados."
  },
  {
    "title": "Un paso más hacia tu objetivo."
  },
  {
    "title": "Tu progreso empieza hoy."
  },
  {
    "title": "Entrená con propósito."
  },
  {
    "title": "La disciplina hace la diferencia."
  },
  {
    "title": "Mejor que ayer."
  },
  {
    "title": "Cada repetición suma."
  },
  {
    "title": "El progreso lleva tiempo."
  },
  {
    "title": "Construí tu mejor versión."
  },
  {
    "title": "Lo importante es continuar."
  },
  {
    "title": "Pequeños avances, grandes cambios."
  },
  {
    "title": "Tu esfuerzo tiene valor."
  },
  {
    "title": "La fuerza se construye."
  },
  {
    "title": "Seguí sumando días."
  },
  {
    "title": "Cada día es una oportunidad."
  },
  {
    "title": "Entrená, aprendé y progresá."
  },
  {
    "title": "La constancia supera la motivación."
  },
  {
    "title": "El cambio empieza con acción."
  }
];

const DAY_IN_MILLISECONDS = 86_400_000;

function calendarDayNumber(dateKey: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) throw new Error("La fecha del enfoque diario no es válida.");
  const [, year, month, day] = match;
  return Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day)) / DAY_IN_MILLISECONDS);
}

export function argentinaDailyFocusDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_FOCUS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function dailyFocusForDate(dateKey: string): DailyFocusMessage {
  const index = ((calendarDayNumber(dateKey) % DAILY_FOCUS_MESSAGES.length) + DAILY_FOCUS_MESSAGES.length) % DAILY_FOCUS_MESSAGES.length;
  return DAILY_FOCUS_MESSAGES[index];
}

export function dailyFocusForInstant(date = new Date()) {
  return dailyFocusForDate(argentinaDailyFocusDateKey(date));
}
