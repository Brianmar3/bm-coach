export const DAILY_FOCUS_PHRASES = [
  "La constancia construye lo que la motivación comienza.",
  "No necesitás hacerlo perfecto, necesitás hacerlo.",
  "Cada sesión cuenta.",
  "Lo que repetís, mejora.",
  "El progreso también se construye en los días difíciles.",
  "Entrená hoy pensando en quién querés ser mañana.",
  "La disciplina te lleva donde las ganas no alcanzan.",
  "Un paso sostenido vale más que un impulso aislado.",
  "Cumplir con lo simple también es progresar.",
  "Tu mejor ritmo es el que podés sostener.",
] as const;

export function dailyFocusForDate(dateKey: string) {
  const numericDate = Number(dateKey.replaceAll("-", ""));
  return DAILY_FOCUS_PHRASES[numericDate % DAILY_FOCUS_PHRASES.length];
}
