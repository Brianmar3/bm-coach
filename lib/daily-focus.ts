export const DAILY_FOCUS_TIME_ZONE = "America/Argentina/Buenos_Aires";

export const DAILY_FOCUS_CATEGORIES = [
  "habitos",
  "disciplina",
  "mentalidad",
  "estoicismo",
  "perseverancia",
  "proposito",
  "progreso",
  "tecnica",
  "recuperacion",
] as const;

export type DailyFocusCategory = (typeof DAILY_FOCUS_CATEGORIES)[number];

export type DailyFocusMessage = {
  title: string;
  reflection: string;
  category: DailyFocusCategory;
};

export const DAILY_FOCUS_MESSAGES: readonly DailyFocusMessage[] = [
  { title: "Cada entrenamiento es un voto por la persona en la que te querés convertir.", reflection: "No necesitás transformar todo hoy. Necesitás seguir acumulando decisiones coherentes.", category: "habitos" },
  { title: "Los resultados aparecen después de repetir pequeñas decisiones durante suficiente tiempo.", reflection: "Una sola sesión no cambia todo, pero cada sesión refuerza el proceso que finalmente sí lo hace.", category: "habitos" },
  { title: "Tus hábitos diarios terminan definiendo mucho más que tus intenciones.", reflection: "Pensar en cambiar sirve de poco si tus acciones siguen siendo siempre las mismas.", category: "habitos" },
  { title: "No necesitás una jornada perfecta. Necesitás evitar abandonar el proceso.", reflection: "Un día incompleto no destruye tu progreso. Dejar de volver sí puede hacerlo.", category: "habitos" },
  { title: "Lo difícil muchas veces no es entrenar, sino dar el primer paso.", reflection: "Empezar reduce la resistencia. Una vez en movimiento, continuar suele ser más simple.", category: "habitos" },
  { title: "Repetir lo básico correctamente produce más que cambiar de estrategia todo el tiempo.", reflection: "La constancia necesita menos novedades y más decisiones sostenidas.", category: "habitos" },
  { title: "El progreso puede parecer invisible antes de hacerse evidente.", reflection: "Muchos cambios se acumulan en silencio antes de empezar a notarse.", category: "habitos" },
  { title: "Organizar el entorno puede ser más efectivo que depender de la motivación.", reflection: "Preparar el horario, la ropa y el entrenamiento reduce las excusas del momento.", category: "habitos" },
  { title: "Una acción pequeña repetida vale más que una gran intención postergada.", reflection: "El cambio se construye con lo que hacés, no solamente con lo que planeás.", category: "habitos" },
  { title: "Cada vez que cumplís fortalecés el hábito de volver.", reflection: "No entrenás solamente el cuerpo; también entrenás la capacidad de sostener decisiones.", category: "habitos" },
  { title: "La identidad se construye con acciones repetidas.", reflection: "Cada sesión confirma que sos una persona que se cuida y trabaja por mejorar.", category: "habitos" },
  { title: "No busques hacerlo perfecto. Buscá hacerlo de manera sostenible.", reflection: "El mejor plan no es el más extremo, sino el que podés mantener.", category: "habitos" },
  { title: "Tener ganas es opcional. Cumplir con tu compromiso es una decisión.", reflection: "La disciplina aparece cuando actuás aunque el entusiasmo no esté presente.", category: "disciplina" },
  { title: "La disciplina no consiste en castigarte, sino en dirigir tus decisiones.", reflection: "Elegir lo que te acerca a tu objetivo también es una forma de libertad.", category: "disciplina" },
  { title: "Cada vez que elegís cumplir, fortalecés algo más importante que el cuerpo.", reflection: "Desarrollás confianza en tu propia palabra y en tu capacidad de sostenerte.", category: "disciplina" },
  { title: "Ser disciplinado no significa no fallar. Significa volver rápido al camino.", reflection: "El error importa menos que la respuesta que elegís después.", category: "disciplina" },
  { title: "La disciplina te permite dejar de depender de cómo te sentís.", reflection: "Tus emociones cambian; tus decisiones pueden seguir teniendo dirección.", category: "disciplina" },
  { title: "El esfuerzo de entrenar dura un momento. La satisfacción de haber cumplido permanece.", reflection: "Muchas veces lo más difícil ocurre antes de empezar.", category: "disciplina" },
  { title: "El verdadero control aparece cuando hacés lo necesario sin que nadie te observe.", reflection: "La constancia privada termina mostrando resultados públicos.", category: "disciplina" },
  { title: "Tu futuro depende más de decisiones pequeñas que de promesas grandes.", reflection: "La transformación rara vez ocurre de golpe; suele ser acumulativa.", category: "disciplina" },
  { title: "No necesitás exigirte sin límite. Necesitás aprender a cumplir con criterio.", reflection: "Disciplina también es saber cuándo avanzar, ajustar o recuperarte.", category: "disciplina" },
  { title: "La disciplina convierte objetivos abstractos en acciones concretas.", reflection: "Cada serie, cada comida y cada descanso forman parte del mismo proceso.", category: "disciplina" },
  { title: "Postergar también es una decisión.", reflection: "Elegí conscientemente qué hábito querés reforzar hoy.", category: "disciplina" },
  { title: "Cumplir en los días comunes construye más que esforzarte solo en días excepcionales.", reflection: "El progreso depende de lo que repetís, no de momentos aislados.", category: "disciplina" },
  { title: "Tu capacidad actual no es un límite definitivo.", reflection: "Es solamente el punto desde el que empezás a trabajar.", category: "mentalidad" },
  { title: "Equivocarte no significa que no puedas. Significa que todavía estás aprendiendo.", reflection: "Cada corrección bien usada acorta el camino hacia una mejor ejecución.", category: "mentalidad" },
  { title: "El esfuerzo no demuestra falta de capacidad. Es la herramienta que la desarrolla.", reflection: "Lo que hoy cuesta puede volverse más simple con práctica sostenida.", category: "mentalidad" },
  { title: "Cambiar “no puedo” por “todavía no puedo” cambia la forma de actuar.", reflection: "La palabra todavía deja espacio para el aprendizaje y el progreso.", category: "mentalidad" },
  { title: "Una corrección técnica no es una crítica.", reflection: "Es información que puede ayudarte a entrenar con más seguridad y eficacia.", category: "mentalidad" },
  { title: "Compararte con tu versión anterior puede orientarte mejor que compararte con otros.", reflection: "Tu progreso necesita una referencia propia.", category: "mentalidad" },
  { title: "Tu nivel actual no define hasta dónde podés llegar.", reflection: "La práctica, la paciencia y la constancia amplían tus capacidades.", category: "mentalidad" },
  { title: "La mejora comienza cuando aceptás que siempre hay algo nuevo por aprender.", reflection: "Entrenar también es observar, ajustar y volver a intentar.", category: "mentalidad" },
  { title: "No midas solamente lo que lograste.", reflection: "Observá también cuánto mejoraste para poder conseguirlo.", category: "mentalidad" },
  { title: "La confianza aparece después de acumular evidencia.", reflection: "Cada vez que cumplís, le demostrás a tu mente que puede confiar en vos.", category: "mentalidad" },
  { title: "No controlás cómo empieza el día, pero sí cómo respondés.", reflection: "Tu margen de acción está en lo que elegís hacer ahora.", category: "estoicismo" },
  { title: "Concentrate en lo que depende de vos.", reflection: "Presentarte, ejecutar con criterio y sostener el esfuerzo son decisiones propias.", category: "estoicismo" },
  { title: "El cansancio y la falta de ganas son sensaciones, no órdenes.", reflection: "Podés escucharlas sin dejar que decidan por vos.", category: "estoicismo" },
  { title: "No te castigues por lo que ya pasó.", reflection: "Volvé a elegir correctamente en la próxima acción.", category: "estoicismo" },
  { title: "La paciencia también es una forma de fortaleza.", reflection: "No todos los resultados se aceleran por esforzarte más.", category: "estoicismo" },
  { title: "Aceptar un día difícil no significa rendirse ante él.", reflection: "Significa reconocer la realidad y actuar con inteligencia.", category: "estoicismo" },
  { title: "La serenidad permite tomar mejores decisiones que la ansiedad.", reflection: "Avanzar rápido no sirve si perdés dirección.", category: "estoicismo" },
  { title: "Tu responsabilidad está en el esfuerzo y la técnica.", reflection: "El resultado necesita tiempo y no siempre aparece al ritmo que esperás.", category: "estoicismo" },
  { title: "No necesitás sentirte perfecto para actuar correctamente.", reflection: "Muchas buenas decisiones se toman en días imperfectos.", category: "estoicismo" },
  { title: "La incomodidad no siempre es una señal para detenerte.", reflection: "Aprendé a distinguir entre esfuerzo, cansancio y dolor real.", category: "estoicismo" },
  { title: "La diferencia muchas veces no está en quién empieza mejor, sino en quién continúa.", reflection: "La constancia termina superando a muchos comienzos intensos.", category: "perseverancia" },
  { title: "Seguir trabajando cuando el progreso es lento también forma parte del resultado.", reflection: "No todo avance es visible de inmediato.", category: "perseverancia" },
  { title: "La perseverancia no significa insistir sin pensar.", reflection: "Significa ajustar lo necesario sin abandonar el objetivo.", category: "perseverancia" },
  { title: "No abandones un proceso largo por una semana imperfecta.", reflection: "Una semana difícil no define todo el camino.", category: "perseverancia" },
  { title: "La resistencia mental también se entrena cada vez que decidís volver.", reflection: "Volver fortalece más que castigarte por haberte alejado.", category: "perseverancia" },
  { title: "Un objetivo importante requiere tolerar períodos sin grandes cambios.", reflection: "La paciencia es parte del entrenamiento.", category: "perseverancia" },
  { title: "El talento puede ayudar, pero la constancia desarrolla ese potencial.", reflection: "Lo que sostenés termina pesando más que lo que prometés.", category: "perseverancia" },
  { title: "Los resultados profundos suelen exigir más paciencia de la esperada.", reflection: "No confundas lentitud con falta de progreso.", category: "perseverancia" },
  { title: "Cuando tenés claro para qué entrenás, es más fácil atravesar los días difíciles.", reflection: "Un motivo profundo pesa más que una excusa momentánea.", category: "proposito" },
  { title: "No entrenes solamente para cambiar tu cuerpo.", reflection: "Entrená también para cuidar la vida que querés construir.", category: "proposito" },
  { title: "Tu razón para continuar debe ser más profunda que tu estado de ánimo.", reflection: "La motivación cambia; el propósito puede mantenerse.", category: "proposito" },
  { title: "Cuidar tu salud es una forma concreta de respetar tu futuro.", reflection: "Cada decisión de hoy tiene efecto sobre la vida que vas a tener mañana.", category: "proposito" },
  { title: "Un objetivo con sentido ordena mejor tus decisiones.", reflection: "Cuando sabés hacia dónde vas, es más fácil elegir qué hacer.", category: "proposito" },
  { title: "El esfuerzo se tolera mejor cuando entendés hacia dónde te lleva.", reflection: "Recordar tu propósito ayuda a atravesar la incomodidad.", category: "proposito" },
  { title: "El entrenamiento puede darte dirección, confianza y autonomía.", reflection: "No todo progreso se mide solamente en kilos o repeticiones.", category: "proposito" },
  { title: "Incluso una acción pequeña puede recuperar sentido cuando está conectada con algo importante.", reflection: "El valor de la sesión depende también de para qué la hacés.", category: "proposito" },
  { title: "El progreso no siempre consiste en levantar más peso.", reflection: "También puede ser mejorar la técnica, el control o la constancia.", category: "progreso" },
  { title: "Pequeñas mejoras sostenidas generan grandes diferencias.", reflection: "Buscá avanzar un poco sin exigir cambios imposibles.", category: "progreso" },
  { title: "Tu mejor referencia es lo que hiciste anteriormente.", reflection: "Usá tus registros para tomar mejores decisiones.", category: "progreso" },
  { title: "Progresar también es aprender a entrenar mejor.", reflection: "Más esfuerzo no siempre significa mejor resultado.", category: "progreso" },
  { title: "Cada registro convierte sensaciones en información útil.", reflection: "Lo que medís puede ayudarte a ajustar y mejorar.", category: "progreso" },
  { title: "No todo avance se ve en el espejo.", reflection: "La fuerza, la energía y la capacidad también forman parte del progreso.", category: "progreso" },
  { title: "Mejorar una cosa por vez puede ser suficiente.", reflection: "La acumulación de pequeños avances transforma el resultado final.", category: "progreso" },
  { title: "No confundas intensidad con progreso.", reflection: "Entrenar con dirección vale más que simplemente terminar agotado.", category: "progreso" },
  { title: "Control primero, carga después.", reflection: "Una buena ejecución permite progresar con más seguridad.", category: "tecnica" },
  { title: "La técnica también es progreso.", reflection: "Mover mejor es tan importante como mover más.", category: "tecnica" },
  { title: "Cada repetición es una oportunidad para practicar.", reflection: "No esperes a la última serie para concentrarte.", category: "tecnica" },
  { title: "Más control suele producir mejores resultados.", reflection: "No apures el movimiento solamente para terminar antes.", category: "tecnica" },
  { title: "La calidad de la serie importa más que completar por completar.", reflection: "Una repetición bien ejecutada deja una mejor base para progresar.", category: "tecnica" },
  { title: "Recuperarte bien también es entrenar.", reflection: "El descanso permite que el esfuerzo se convierta en adaptación.", category: "recuperacion" },
  { title: "Dormir mejor puede mejorar tanto como entrenar más.", reflection: "La recuperación afecta la fuerza, la energía y la concentración.", category: "recuperacion" },
  { title: "Entrenar mejor vale más que entrenar de más.", reflection: "Agregar volumen sin recuperación puede alejarte del resultado.", category: "recuperacion" },
  { title: "Respetar los descansos también forma parte del plan.", reflection: "No todo el progreso ocurre mientras estás entrenando.", category: "recuperacion" },
  { title: "Escuchar tu cuerpo no significa buscar excusas.", reflection: "Significa aprender a tomar decisiones con información real.", category: "recuperacion" },
] as const;

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
