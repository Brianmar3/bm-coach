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
  "Avanzar con intención vale más que apurarse sin dirección.",
  "La técnica también es una forma de progreso.",
  "Escuchar al cuerpo es parte de entrenar bien.",
  "Hoy no tiene que ser extraordinario para que cuente.",
  "La regularidad transforma pequeños esfuerzos en resultados.",
  "Concentrate en la próxima repetición.",
  "El descanso también sostiene tu rendimiento.",
  "Construí hábitos que acompañen tus objetivos.",
  "Cada entrenamiento es información para seguir mejorando.",
  "Progresar también es aprender a regular el esfuerzo.",
  "Entrenar con paciencia es entrenar para sostenerlo.",
  "La mejora real se reconoce con el tiempo.",
  "Hacé espacio para avanzar a tu manera.",
  "La calidad de cada sesión importa más que la prisa.",
] as const;

export function dailyFocusForDate(dateKey: string) {
  const numericDate = Number(dateKey.replaceAll("-", ""));
  return DAILY_FOCUS_PHRASES[numericDate % DAILY_FOCUS_PHRASES.length];
}
