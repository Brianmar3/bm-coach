export const NUTRITION_EDUCATION_CATEGORIES = [
  "Fundamentos de alimentación",
  "Proteínas, carbohidratos y grasas",
  "Hidratación",
  "Alimentación antes de entrenar",
  "Alimentación después de entrenar",
  "Organización semanal",
  "Lectura de etiquetas",
  "Porciones y señales de hambre",
  "Alimentación para ganar masa muscular",
  "Alimentación para reducir grasa",
  "Alimentación y rendimiento",
  "Sueño y recuperación",
  "Suplementos",
  "Mitos frecuentes",
  "Compras y presupuesto",
  "Comer fuera de casa",
  "Hábitos sostenibles",
] as const;

export type NutritionEducationQuiz = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
};

export type NutritionEducationItem = {
  id: string;
  category: (typeof NUTRITION_EDUCATION_CATEGORIES)[number];
  title: string;
  summary: string;
  format: "Artículo" | "Guía rápida" | "Preguntas frecuentes" | "Mitos y realidades" | "Ejemplos de comidas" | "Comparación" | "Checklist" | "Mini cuestionario" | "Desafío semanal";
  durationMinutes: number;
  level: "Inicial" | "Intermedio";
  tags: string[];
  objectiveTags: Array<"GENERAL" | "MUSCLE_GAIN" | "FAT_LOSS" | "PERFORMANCE">;
  explanation: string[];
  whyItMatters: string;
  examples: string[];
  mistakes: string[];
  application: string;
  challenge: string;
  keyPoints: string[];
  professionalWarning?: string;
  quiz?: NutritionEducationQuiz;
};

const commonWarning = "Este contenido es educativo y no reemplaza una consulta con un profesional de salud. Si tenés una condición clínica, síntomas, embarazo o medicación, necesitás una indicación individual.";

export const NUTRITION_EDUCATION: NutritionEducationItem[] = [
  {
    id: "balanced-plate", category: "Fundamentos de alimentación", title: "Cómo armar un plato equilibrado", format: "Guía rápida", durationMinutes: 6, level: "Inicial", tags: ["plato", "verduras", "organización"], objectiveTags: ["GENERAL", "MUSCLE_GAIN", "FAT_LOSS"],
    summary: "Una estructura flexible para combinar verduras, energía y proteína sin pesar alimentos.",
    explanation: ["Un plato equilibrado no es una fórmula rígida. Como punto de partida, combiná una porción abundante de verduras, una fuente de proteína y una fuente de carbohidratos; sumá una grasa culinaria en cantidad razonable.", "La proporción puede cambiar según hambre, objetivo, entrenamiento y disponibilidad. En un día intenso quizá necesites más arroz, papa, fideos o pan; en otro, una porción menor puede alcanzarte."],
    whyItMatters: "Tener una estructura reduce decisiones improvisadas y ayuda a que una comida sea completa y satisfactoria.",
    examples: ["Milanesa al horno con ensalada y papa", "Lentejas con arroz, zapallo y huevo", "Pollo con puré y verduras salteadas"],
    mistakes: ["Pensar que todos los platos deben verse idénticos", "Eliminar el carbohidrato por miedo", "Usar solo ensalada y quedar con hambre"],
    application: "Elegí la próxima comida principal y marcá qué alimento cumple cada función: proteína, energía, verduras y grasa.",
    challenge: "Armá tres platos distintos con alimentos que ya tenés, sin comprar productos especiales.",
    keyPoints: ["La estructura es flexible", "La cantidad depende del contexto", "La variedad semanal importa más que un plato perfecto"],
    quiz: { id: "balanced-plate-1", question: "¿Qué describe mejor un plato equilibrado?", options: ["Una fórmula idéntica para todos", "Una combinación flexible de grupos de alimentos", "Un plato sin carbohidratos", "Solo alimentos light"], correctAnswer: 1, explanation: "Es una guía flexible que se adapta al hambre, el entrenamiento y la disponibilidad." },
  },
  {
    id: "protein-sources", category: "Proteínas, carbohidratos y grasas", title: "Proteínas: cantidad y fuentes habituales", format: "Artículo", durationMinutes: 8, level: "Inicial", tags: ["proteína", "recuperación", "fuentes"], objectiveTags: ["MUSCLE_GAIN", "FAT_LOSS", "PERFORMANCE", "GENERAL"],
    summary: "Cómo distribuir fuentes proteicas cotidianas sin depender de suplementos.",
    explanation: ["La proteína participa en la reparación de tejidos y en muchas funciones del organismo. Huevos, carnes, pescados, leche, yogur, quesos, legumbres, soja y combinaciones de cereales con legumbres son fuentes habituales.", "En vez de perseguir una cifra aislada, empezá por incluir una fuente reconocible en comidas principales. La cantidad exacta depende de tu cuerpo, entrenamiento y situación de salud, y puede requerir evaluación profesional."],
    whyItMatters: "Una distribución regular suele ser más fácil de sostener que intentar concentrar toda la proteína en una sola comida.",
    examples: ["Tortilla de huevo y verduras", "Yogur con avena", "Guiso de lentejas", "Carne, pollo o pescado con guarnición"],
    mistakes: ["Creer que proteína significa solo carne", "Comprar suplementos antes de ordenar comidas", "Ignorar alergias o tolerancia digestiva"],
    application: "Revisá desayuno, almuerzo, merienda y cena e identificá dónde ya hay proteína y dónde falta una opción realista.",
    challenge: "Probá una fuente distinta en dos comidas de esta semana.",
    keyPoints: ["Hay fuentes animales y vegetales", "La regularidad facilita el objetivo", "La dosis individual no se adivina"], professionalWarning: commonWarning,
  },
  {
    id: "carbs-training", category: "Proteínas, carbohidratos y grasas", title: "Carbohidratos y entrenamiento", format: "Comparación", durationMinutes: 7, level: "Inicial", tags: ["carbohidratos", "energía", "entrenamiento"], objectiveTags: ["PERFORMANCE", "MUSCLE_GAIN", "GENERAL"],
    summary: "Por qué arroz, papa, avena, pan, frutas y legumbres pueden acompañar el rendimiento.",
    explanation: ["Los carbohidratos aportan energía utilizable para la vida diaria y el entrenamiento. No todos llegan en el mismo envase: una fruta, una papa, pan o legumbres también aportan agua, fibra y otros nutrientes en cantidades diferentes.", "Cerca del entrenamiento suele convenir priorizar opciones conocidas y fáciles de digerir. Lejos del ejercicio hay más margen para preparaciones con fibra y volumen."],
    whyItMatters: "Restringirlos sin motivo puede hacer más difícil entrenar con energía y recuperarse.",
    examples: ["Banana o tostada cuando falta poco", "Arroz con pollo después de entrenar", "Avena con yogur en un desayuno con tiempo"],
    mistakes: ["Clasificarlos como buenos o malos", "Probar mucha fibra justo antes de entrenar", "Confundir reducción de grasa con eliminación total"],
    application: "Observá qué comiste antes de dos entrenamientos y registrá energía y tolerancia, sin cambiar todo a la vez.",
    challenge: "Elegí una fuente conocida para tu próximo entrenamiento y evaluá cómo te sentiste.",
    keyPoints: ["Son una fuente de energía", "El momento modifica la elección", "La tolerancia personal guía ajustes"],
  },
  {
    id: "healthy-fats", category: "Proteínas, carbohidratos y grasas", title: "Grasas: funciones y selección", format: "Artículo", durationMinutes: 6, level: "Inicial", tags: ["grasas", "aceite", "semillas"], objectiveTags: ["GENERAL", "MUSCLE_GAIN", "FAT_LOSS"],
    summary: "Qué función cumplen y cómo elegirlas sin convertirlas en enemigas ni usarlas sin medida.",
    explanation: ["Las grasas forman parte de membranas, hormonas y absorción de vitaminas. Aceites, palta, maní, nueces, semillas, aceitunas, huevos y pescados aportan grasas en distintos contextos.", "Son concentradas en energía, por lo que una porción pequeña puede ser suficiente. Cerca del entrenamiento, una comida muy grasa puede resultar lenta de digerir para algunas personas."],
    whyItMatters: "La calidad, la frecuencia y el contexto importan más que etiquetar una grasa aislada como milagrosa.",
    examples: ["Aceite en una ensalada", "Un puñado pequeño de maní", "Palta en una tostada", "Pescado en una comida principal"],
    mistakes: ["Eliminar todas las grasas", "Asumir que saludable significa ilimitado", "Comer una preparación muy grasa antes de entrenar sin probar tolerancia"],
    application: "Identificá las grasas que ya aparecen en tus comidas y evitá sumar varias sin darte cuenta.",
    challenge: "Durante tres días, observá qué grasa culinaria usás y en qué cantidad aproximada.",
    keyPoints: ["Cumplen funciones necesarias", "La porción cuenta", "La digestión puede ser más lenta"],
  },
  {
    id: "daily-hydration", category: "Hidratación", title: "Hidratación cotidiana", format: "Checklist", durationMinutes: 5, level: "Inicial", tags: ["agua", "hidratación", "calor"], objectiveTags: ["GENERAL", "PERFORMANCE", "MUSCLE_GAIN", "FAT_LOSS"],
    summary: "Señales y rutinas para beber con regularidad, especialmente con calor o entrenamiento.",
    explanation: ["Las necesidades cambian con el clima, la transpiración, el tamaño corporal, la comida y el ejercicio. Por eso una cifra universal puede ser engañosa.", "Tener agua visible, llevar botella y beber en comidas crea señales estables. Orina muy oscura, sed marcada o dolor de cabeza pueden acompañar baja ingesta, aunque los síntomas también tienen otras causas."],
    whyItMatters: "La deshidratación puede afectar bienestar y rendimiento, mientras beber cantidades extremas también puede ser riesgoso.",
    examples: ["Botella en el escritorio", "Agua junto al mate", "Sorbos antes, durante y después de entrenar según sed y tolerancia"],
    mistakes: ["Esperar a tener mucha sed", "Contar el mate como única bebida", "Forzarse a tomar cantidades extremas"],
    application: "Elegí tres momentos del día que funcionen como recordatorio: desayuno, almuerzo y salida al entrenamiento.",
    challenge: "Usá la misma botella durante dos días y observá cuándo te resulta más fácil beber.",
    keyPoints: ["Las necesidades varían", "Los recordatorios ayudan", "Más no siempre es mejor"], professionalWarning: commonWarning,
    quiz: { id: "hydration-1", question: "¿Cuál es la estrategia más sostenible?", options: ["Esperar sed intensa", "Tomar una cantidad extrema de una vez", "Crear recordatorios y beber regularmente", "Usar solo bebidas energéticas"], correctAnswer: 2, explanation: "La regularidad y la adaptación al contexto son más útiles que extremos." },
  },
  {
    id: "pre-training-food", category: "Alimentación antes de entrenar", title: "Qué comer antes de entrenar", format: "Guía rápida", durationMinutes: 9, level: "Inicial", tags: ["preentreno", "digestión", "mate"], objectiveTags: ["PERFORMANCE", "MUSCLE_GAIN", "GENERAL"],
    summary: "Opciones prácticas según falten tres horas, noventa minutos o treinta minutos.",
    explanation: ["Con unas tres horas suele haber margen para una comida completa conocida: proteína, carbohidrato, algo de verduras y líquidos. A noventa minutos conviene reducir volumen y grasa si sos sensible; por ejemplo yogur con banana o tostadas con queso.", "A treinta minutos, una opción pequeña y fácil de digerir —banana, pan o tostada simple— suele ser más tolerable. Si entrenás temprano, prepará algo la noche anterior y no pruebes una comida nueva. El mate puede acompañar, pero no reemplaza agua ni conviene forzar cafeína si te cae mal."],
    whyItMatters: "El objetivo es llegar con energía y sin molestias, no cumplir una comida perfecta.",
    examples: ["3 h: arroz con pollo", "90 min: tostadas con huevo si lo tolerás", "30 min: banana o tostada simple", "Temprano: yogur y fruta preparados"],
    mistakes: ["Comer mucho y graso con poco tiempo", "Entrenar siempre en ayunas aunque te sientas mal", "Probar suplementos nuevos antes de una sesión"],
    application: "Elegí una opción según el tiempo real que falta y anotá energía, hambre y digestión.",
    challenge: "Probá el mismo preentreno dos veces antes de sacar conclusiones.",
    keyPoints: ["Menos tiempo suele pedir menos volumen", "La tolerancia manda", "El mate no reemplaza la hidratación"], professionalWarning: commonWarning,
    quiz: { id: "pre-training-1", question: "Si faltan 30 minutos, ¿qué opción suele ser más fácil de digerir?", options: ["Comida abundante con mucha grasa", "Fruta o tostada simple", "Plato grande de legumbres", "Comida frita"], correctAnswer: 1, explanation: "Con poco margen suele convenir una porción pequeña, conocida y baja en grasa." },
  },
  {
    id: "post-training-food", category: "Alimentación después de entrenar", title: "Qué comer después de entrenar", format: "Ejemplos de comidas", durationMinutes: 7, level: "Inicial", tags: ["postentreno", "recuperación", "proteína"], objectiveTags: ["PERFORMANCE", "MUSCLE_GAIN", "GENERAL"],
    summary: "Comidas cotidianas para recuperar energía, sumar proteína e hidratarte.",
    explanation: ["Después del entrenamiento, una comida con proteína y carbohidratos acompaña la reparación y la reposición de energía. No existe una ventana de pocos minutos que obligue a comer con ansiedad.", "Si tu próxima comida está cerca, puede resolver la recuperación. Si faltan varias horas, una colación práctica ayuda a no llegar con hambre extrema."],
    whyItMatters: "Planificar la transición evita depender de productos especiales o de la primera opción disponible.",
    examples: ["Sándwich de pollo y fruta", "Yogur, avena y banana", "Arroz con huevo y verduras", "Leche y tostadas si luego cenás"],
    mistakes: ["Creer que solo sirve un batido", "Olvidar beber", "Compensar el ejercicio con una restricción posterior"],
    application: "Definí antes de entrenar cuál será tu próxima comida o colación.",
    challenge: "Dejá lista una opción simple para dos entrenamientos de esta semana.",
    keyPoints: ["Una comida común puede alcanzar", "Proteína y carbohidrato son una base útil", "La urgencia depende del resto del día"],
  },
  {
    id: "simple-breakfasts", category: "Organización semanal", title: "Desayunos simples", format: "Ejemplos de comidas", durationMinutes: 5, level: "Inicial", tags: ["desayuno", "rápido", "organización"], objectiveTags: ["GENERAL", "MUSCLE_GAIN", "FAT_LOSS"],
    summary: "Bases rápidas que se pueden adaptar al hambre, horario y presupuesto.",
    explanation: ["Un desayuno no necesita ser complejo. Elegí una base de energía, una fuente de proteína y, cuando sea posible, fruta. Si no tenés hambre temprano, una opción pequeña o más tarde también puede ser válida.", "Preparar la mesa, porcionar avena o dejar huevos cocidos reduce decisiones de mañana."],
    whyItMatters: "Una base repetible facilita la constancia sin exigir variedad total todos los días.",
    examples: ["Tostadas, huevo y fruta", "Yogur con avena y banana", "Mate con sándwich de queso", "Leche con avena y manzana"],
    mistakes: ["Pensar que debe ser dulce o salado sí o sí", "Usar solo infusión y llegar con hambre extrema", "Copiar una porción ajena"],
    application: "Elegí dos desayunos para alternar y prepará sus ingredientes visibles.",
    challenge: "Sostené una opción práctica tres mañanas y evaluá hambre y energía.",
    keyPoints: ["Simple es válido", "Preparar reduce fricción", "La porción responde a tu hambre"],
  },
  {
    id: "practical-snacks", category: "Organización semanal", title: "Meriendas prácticas", format: "Checklist", durationMinutes: 5, level: "Inicial", tags: ["merienda", "trabajo", "transporte"], objectiveTags: ["GENERAL", "MUSCLE_GAIN", "FAT_LOSS"],
    summary: "Opciones transportables para evitar que la merienda dependa de la improvisación.",
    explanation: ["La merienda puede cerrar un intervalo largo y ayudar a llegar a la cena con hambre manejable. No es obligatoria si no la necesitás.", "Combiná algo fácil de transportar con una fuente de proteína o saciedad según el tiempo hasta la próxima comida."],
    whyItMatters: "Tener una alternativa disponible permite elegir mejor en jornadas cambiantes.",
    examples: ["Fruta y yogur", "Tostadas o sándwich simple", "Leche y banana", "Fruta con un puñado de maní"],
    mistakes: ["Comer por horario sin hambre", "No llevar nada en un día muy largo", "Creer que una merienda debe ser un producto dietético"],
    application: "Armá una lista de una opción con frío y otra sin frío.",
    challenge: "Llevá una merienda de respaldo dos días esta semana.",
    keyPoints: ["Es opcional", "Debe encajar en el día", "Una alternativa de respaldo ayuda"],
  },
  {
    id: "quick-dinners", category: "Organización semanal", title: "Cenas rápidas", format: "Ejemplos de comidas", durationMinutes: 6, level: "Inicial", tags: ["cena", "rápido", "freezer"], objectiveTags: ["GENERAL", "MUSCLE_GAIN", "FAT_LOSS"],
    summary: "Cómo resolver una cena completa con bases de heladera, alacena o freezer.",
    explanation: ["Una cena rápida empieza antes del cansancio: huevos, verduras congeladas, arroz cocido, legumbres y latas seguras pueden combinarse en minutos.", "Repetir una base no significa comer igual: cambiá condimentos, verduras o formato para sostener variedad."],
    whyItMatters: "Disminuye la dependencia de delivery y evita saltear la comida por falta de ideas.",
    examples: ["Revuelto de huevo, verduras y pan", "Arroz con atún y tomate", "Fideos con lentejas y salsa", "Tortilla con ensalada"],
    mistakes: ["Esperar a decidir cuando ya hay mucha hambre", "Comprar ingredientes que requieren demasiado tiempo", "Confundir rápido con nutricionalmente perfecto"],
    application: "Definí dos cenas de emergencia con ingredientes que duren al menos una semana.",
    challenge: "Prepará una porción extra y guardala de forma segura para otro día.",
    keyPoints: ["Las bases listas ahorran tiempo", "Congelados y conservas pueden ser útiles", "Plan B supera a improvisar"],
  },
  {
    id: "muscle-gain", category: "Alimentación para ganar masa muscular", title: "Alimentación para ganar masa muscular", format: "Artículo", durationMinutes: 9, level: "Intermedio", tags: ["masa muscular", "energía", "proteína"], objectiveTags: ["MUSCLE_GAIN"],
    summary: "Energía suficiente, proteína distribuida y entrenamiento progresivo sin atajos.",
    explanation: ["Ganar masa muscular requiere estímulo de entrenamiento, recuperación y energía suficiente. Sumar comida de forma gradual suele ser más tolerable que forzar porciones enormes.", "Distribuí fuentes proteicas, carbohidratos y comidas que puedas sostener. El cambio corporal lleva tiempo; el peso diario fluctúa por agua, comida y otros factores."],
    whyItMatters: "Centrarse solo en proteína ignora energía, sueño, entrenamiento y adherencia.",
    examples: ["Agregar una merienda con yogur y avena", "Aumentar una guarnición de arroz o papa", "Sumar leche y fruta a un desayuno"],
    mistakes: ["Comer sin límite esperando músculo puro", "Usar suplementos como base", "Cambiar todo por una semana"],
    application: "Detectá el momento del día donde te cuesta alcanzar una comida suficiente y agregá una opción concreta.",
    challenge: "Sostené un agregado simple por siete días y registrá tolerancia y rendimiento.",
    keyPoints: ["El entrenamiento es indispensable", "La energía también importa", "Los cambios deben ser graduales"], professionalWarning: commonWarning,
  },
  {
    id: "fat-loss", category: "Alimentación para reducir grasa", title: "Alimentación para bajar grasa sin extremos", format: "Artículo", durationMinutes: 9, level: "Intermedio", tags: ["saciedad", "hábitos", "grasa corporal"], objectiveTags: ["FAT_LOSS"],
    summary: "Estrategias sostenibles de saciedad y organización, sin ayunos forzados ni listas prohibidas.",
    explanation: ["Reducir grasa corporal no exige eliminar grupos enteros. Comidas con proteína, verduras, frutas, legumbres y porciones adecuadas pueden mejorar saciedad, mientras la organización reduce decisiones impulsivas.", "El ritmo debe ser individual y compatible con energía, entrenamiento, sueño y salud mental. Pérdidas rápidas, purgas o miedo intenso a comer requieren atención profesional."],
    whyItMatters: "Los extremos suelen empeorar hambre, rendimiento y relación con la comida.",
    examples: ["Mantener arroz y aumentar verduras en el plato", "Elegir agua sin prohibir eventos sociales", "Planificar una merienda antes de salir"],
    mistakes: ["Saltarse comidas para compensar", "Demonizar carbohidratos", "Evaluar progreso por un solo pesaje"],
    application: "Elegí una mejora de estructura, no una prohibición: por ejemplo, agregar verduras al almuerzo.",
    challenge: "Durante una semana registrá hambre antes y después de una comida, sin contar calorías.",
    keyPoints: ["La sostenibilidad importa", "Saciedad y organización ayudan", "Los extremos son una señal de alerta"], professionalWarning: commonWarning,
  },
  {
    id: "shopping-plan", category: "Organización semanal", title: "Cómo organizar compras", format: "Checklist", durationMinutes: 7, level: "Inicial", tags: ["compras", "semana", "desperdicio"], objectiveTags: ["GENERAL", "MUSCLE_GAIN", "FAT_LOSS"],
    summary: "Una lista basada en comidas reales para comprar menos de más y resolver mejor la semana.",
    explanation: ["Antes de escribir la lista, revisá alacena, heladera y freezer. Elegí algunas comidas base y repetí ingredientes versátiles en preparaciones diferentes.", "Separá la lista en proteínas, verduras y frutas, fuentes de energía, desayunos o meriendas y básicos. Considerá qué días realmente vas a cocinar."],
    whyItMatters: "La compra conecta intención con disponibilidad y reduce desperdicio.",
    examples: ["Pollo para horno y relleno", "Lentejas para guiso y ensalada", "Verduras frescas y una bolsa congelada de respaldo"],
    mistakes: ["Comprar para una semana ideal", "No revisar lo que ya hay", "Elegir demasiadas recetas distintas"],
    application: "Planificá tres comidas principales y dos soluciones rápidas antes de ir a comprar.",
    challenge: "Usá un ingrediente en dos preparaciones distintas esta semana.",
    keyPoints: ["Revisar antes de comprar", "Planificar según tiempo real", "Los ingredientes versátiles reducen desperdicio"],
  },
  {
    id: "labels", category: "Lectura de etiquetas", title: "Leer etiquetas sin obsesionarse", format: "Guía rápida", durationMinutes: 8, level: "Inicial", tags: ["etiquetas", "ingredientes", "porción"], objectiveTags: ["GENERAL", "FAT_LOSS"],
    summary: "Cómo usar ingredientes, porción y tabla nutricional para comparar productos equivalentes.",
    explanation: ["Empezá por qué producto es, cuánto suele usarse y qué ingredientes aparecen primero. Después mirá la porción declarada y compará productos del mismo tipo en una unidad equivalente.", "Los sellos frontales aportan información, pero no definen por sí solos toda tu alimentación. Frecuencia, cantidad y contexto también cuentan."],
    whyItMatters: "Leer con un propósito evita tanto ignorar información como convertir cada compra en un examen.",
    examples: ["Comparar dos yogures por 100 g", "Revisar si una granola tiene frutos secos o principalmente azúcar", "Mirar sodio en caldos equivalentes"],
    mistakes: ["Comparar porciones distintas", "Elegir solo por una frase de marketing", "Creer que un ingrediente aislado determina salud"],
    application: "Elegí dos productos equivalentes y compará ingredientes, porción y dos nutrientes relevantes.",
    challenge: "Revisá una etiqueta sin decidir si el alimento es bueno o malo; describí solo los datos.",
    keyPoints: ["Compará productos equivalentes", "La porción declarada puede no ser la usada", "El contexto importa"],
    quiz: { id: "labels-1", question: "Para comparar dos productos similares, ¿qué conviene revisar?", options: ["Solo el color del envase", "Porciones equivalentes e ingredientes", "Una frase publicitaria", "Solo las calorías de porciones distintas"], correctAnswer: 1, explanation: "La comparación necesita una base equivalente y más de un dato." },
  },
  {
    id: "portions-satiety", category: "Porciones y señales de hambre", title: "Porciones y saciedad", format: "Desafío semanal", durationMinutes: 7, level: "Inicial", tags: ["hambre", "saciedad", "porciones"], objectiveTags: ["FAT_LOSS", "GENERAL", "MUSCLE_GAIN"],
    summary: "Usar señales corporales y estructura de comida sin depender de medidas rígidas.",
    explanation: ["El hambre puede sentirse como vacío, baja energía o pensamientos persistentes sobre comida. La saciedad aparece gradualmente; comer con mucha distracción o velocidad puede dificultar registrarla.", "Una porción inicial no es un límite moral. Podés servir una cantidad razonable, comer con pausa y decidir si necesitás más."],
    whyItMatters: "Reconocer señales ayuda a ajustar cantidad sin reglas externas permanentes.",
    examples: ["Pausar a mitad de una comida", "Agregar más guarnición en un día de entrenamiento", "Servir snacks en un recipiente"],
    mistakes: ["Esperar hambre extrema", "Confundir saciedad con quedar incómodamente lleno", "Usar la misma porción todos los días"],
    application: "Antes y después de una comida, describí hambre, energía y comodidad con palabras, no con juicio.",
    challenge: "Hacé una comida diaria sin pantalla durante cinco días.",
    keyPoints: ["Las señales cambian", "La porción se puede ajustar", "La atención facilita aprender"], professionalWarning: commonWarning,
  },
  {
    id: "creatine", category: "Suplementos", title: "Creatina", format: "Preguntas frecuentes", durationMinutes: 8, level: "Intermedio", tags: ["creatina", "suplementos", "fuerza"], objectiveTags: ["MUSCLE_GAIN", "PERFORMANCE"],
    summary: "Qué se sabe, qué no hace y por qué conviene revisar salud, producto y necesidad.",
    explanation: ["La creatina es un compuesto estudiado en rendimiento de esfuerzos breves e intensos. No reemplaza entrenamiento, comida ni sueño, y sus efectos no son idénticos en todas las personas.", "La calidad del producto, la situación renal, embarazo, medicación y otras condiciones requieren evaluación profesional. Evitá protocolos extremos o mezclas sin etiqueta clara."],
    whyItMatters: "La evidencia no convierte un suplemento en obligatorio ni elimina la necesidad de evaluar seguridad individual.",
    examples: ["Consultar a un profesional con antecedentes y medicación", "Elegir un producto con rotulado y procedencia", "Priorizar primero entrenamiento y alimentación"],
    mistakes: ["Tomarla como reemplazo de comida", "Copiar dosis de redes", "Comprar mezclas sin composición clara"],
    application: "Antes de comprar, escribí qué objetivo concreto esperás y qué hábitos básicos ya están ordenados.",
    challenge: "Revisá la etiqueta y llevá tus dudas a un profesional, sin iniciar por impulso.",
    keyPoints: ["No es obligatoria", "No reemplaza hábitos", "La seguridad es individual"], professionalWarning: commonWarning,
    quiz: { id: "creatine-1", question: "¿Qué afirmación es correcta?", options: ["Reemplaza el entrenamiento", "Es obligatoria para ganar músculo", "Puede tener usos, pero requiere contexto y no reemplaza hábitos", "Cualquier mezcla sirve"], correctAnswer: 2, explanation: "La posible utilidad depende del contexto y nunca reemplaza las bases." },
  },
  {
    id: "protein-powder", category: "Suplementos", title: "Proteína en polvo", format: "Preguntas frecuentes", durationMinutes: 7, level: "Inicial", tags: ["proteína en polvo", "suplementos", "alimentos"], objectiveTags: ["MUSCLE_GAIN", "PERFORMANCE"],
    summary: "Cuándo puede ser práctica y por qué no es superior por definición a los alimentos.",
    explanation: ["La proteína en polvo es un alimento concentrado que puede resultar práctico cuando cuesta resolver una comida. No es requisito para entrenar ni produce resultados por sí sola.", "Antes de usarla, revisá alergias, tolerancia, ingredientes, procedencia y si realmente cubre una necesidad. Una comida común puede aportar proteína de manera suficiente."],
    whyItMatters: "Evita gastar por presión comercial o desplazar alimentos útiles sin motivo.",
    examples: ["Yogur o leche como alternativa", "Usarla en una situación de transporte si fue evaluada", "Huevos o legumbres en comidas"],
    mistakes: ["Confundir más proteína con más músculo", "Ignorar alérgenos", "Usarla para saltear comidas sistemáticamente"],
    application: "Compará costo, practicidad y tolerancia con dos alternativas alimentarias.",
    challenge: "Resolvé primero tres opciones de proteína con alimentos cotidianos.",
    keyPoints: ["Es opcional", "La practicidad puede ser su ventaja", "El total y el contexto importan"], professionalWarning: commonWarning,
  },
  {
    id: "carb-myths", category: "Mitos frecuentes", title: "Mitos sobre carbohidratos", format: "Mitos y realidades", durationMinutes: 6, level: "Inicial", tags: ["mitos", "carbohidratos", "noche"], objectiveTags: ["GENERAL", "FAT_LOSS", "PERFORMANCE"],
    summary: "Revisamos ideas como “engordan de noche” o “hay que eliminarlos para bajar grasa”.",
    explanation: ["El horario no transforma automáticamente un alimento en grasa corporal. El patrón sostenido, las cantidades, el gasto, el sueño y muchos otros factores explican mejor los cambios.", "Eliminar carbohidratos puede bajar peso rápido por agua y reservas de glucógeno, sin significar una pérdida equivalente de grasa."],
    whyItMatters: "Cuestionar mitos evita restricciones innecesarias y miedo a alimentos cotidianos.",
    examples: ["Cenar papa después de entrenar", "Comer pan en un desayuno completo", "Elegir arroz o legumbres según tolerancia"],
    mistakes: ["Interpretar una fluctuación de peso como grasa", "Atribuir un resultado a un solo alimento", "Seguir reglas virales sin contexto"],
    application: "Elegí una creencia y buscá qué variable relevante está dejando afuera.",
    challenge: "Reincorporá, si es seguro para vos, una fuente temida dentro de una comida equilibrada.",
    keyPoints: ["El horario aislado no explica todo", "Peso y grasa no son sinónimos", "No hace falta eliminar un grupo"],
  },
  {
    id: "budget-eating", category: "Compras y presupuesto", title: "Comer bien con poco presupuesto", format: "Guía rápida", durationMinutes: 8, level: "Inicial", tags: ["presupuesto", "legumbres", "estación"], objectiveTags: ["GENERAL", "MUSCLE_GAIN", "FAT_LOSS"],
    summary: "Bases rendidoras, comparación por uso real y menos desperdicio.",
    explanation: ["Comer variado no exige productos premium. Huevos, legumbres, arroz, avena, verduras de estación, cortes rendidores y congelados simples pueden formar una base útil.", "El precio por paquete no siempre refleja costo por comida: rendimiento, desperdicio y conservación cambian la cuenta."],
    whyItMatters: "Una estrategia realista protege el presupuesto y facilita sostener hábitos.",
    examples: ["Guiso de lentejas con verduras", "Tortilla de papa y huevo", "Avena con leche y banana", "Pollo al horno usado en dos comidas"],
    mistakes: ["Comprar productos dietéticos caros", "No aprovechar freezer", "Comprar grandes cantidades que terminan descartadas"],
    application: "Elegí tres bases económicas y pensá dos usos para cada una.",
    challenge: "Armá dos comidas con lo que ya hay antes de volver a comprar.",
    keyPoints: ["Lo cotidiano puede ser nutritivo", "El desperdicio también cuesta", "Planificar usos mejora rendimiento"],
  },
  {
    id: "weekend-habits", category: "Hábitos sostenibles", title: "Cómo sostener hábitos el fin de semana", format: "Desafío semanal", durationMinutes: 7, level: "Inicial", tags: ["fin de semana", "flexibilidad", "constancia"], objectiveTags: ["GENERAL", "FAT_LOSS", "MUSCLE_GAIN"],
    summary: "Flexibilidad sin convertir el fin de semana en control extremo o abandono total.",
    explanation: ["El fin de semana cambia horarios y contextos, pero no necesita dividirse entre perfección y descontrol. Mantener algunas anclas —hidratación, comidas regulares, frutas o verduras— da estructura.", "Una comida social no requiere compensación. Retomar en la siguiente oportunidad protege tanto el hábito como la relación con la comida."],
    whyItMatters: "Un enfoque flexible dura más que cinco días rígidos seguidos de culpa.",
    examples: ["Desayunar antes de una salida larga", "Compartir una comida y volver a la rutina después", "Llevar agua a una actividad"],
    mistakes: ["Ayunar para compensar", "Esperar al lunes para retomar", "Convertir una elección en juicio personal"],
    application: "Elegí dos anclas realistas para sábado y domingo.",
    challenge: "Practicá retomar en la comida siguiente sin compensación.",
    keyPoints: ["Flexibilidad no es abandono", "No hace falta compensar", "La próxima decisión siempre cuenta"], professionalWarning: commonWarning,
  },
  {
    id: "performance-fueling", category: "Alimentación y rendimiento", title: "Comer para rendir y recuperarte", format: "Artículo", durationMinutes: 8, level: "Intermedio", tags: ["rendimiento", "energía", "recuperación"], objectiveTags: ["PERFORMANCE", "MUSCLE_GAIN"],
    summary: "Cómo observar energía, digestión y recuperación para ajustar hábitos básicos.",
    explanation: ["El rendimiento depende del entrenamiento, energía disponible, hidratación, sueño y recuperación. Una comida aislada no compensa una semana de baja ingesta o descanso insuficiente.", "Registrá señales simples: energía al empezar, molestias digestivas, caída de rendimiento y hambre posterior. Cambiá una variable por vez para aprender qué te funciona."],
    whyItMatters: "Observar patrones evita perseguir soluciones rápidas sin identificar la causa.",
    examples: ["Agregar una colación si entrenás muchas horas después de almorzar", "Llevar agua en días calurosos", "Cenar suficiente tras una sesión nocturna"],
    mistakes: ["Cambiar suplemento, comida y horario a la vez", "Ignorar sueño", "Copiar la estrategia de otra persona"],
    application: "Registrá tres entrenamientos con horario, comida previa, energía y digestión.",
    challenge: "Elegí un ajuste pequeño y repetilo dos veces antes de evaluarlo.",
    keyPoints: ["El rendimiento es multifactorial", "Registrar ayuda a encontrar patrones", "Un cambio por vez enseña más"],
  },
  {
    id: "sleep-recovery", category: "Sueño y recuperación", title: "Sueño, hambre y recuperación", format: "Artículo", durationMinutes: 7, level: "Inicial", tags: ["sueño", "recuperación", "rutina"], objectiveTags: ["GENERAL", "MUSCLE_GAIN", "FAT_LOSS", "PERFORMANCE"],
    summary: "Por qué dormir poco puede alterar energía, apetito, decisiones y recuperación.",
    explanation: ["El sueño participa en recuperación, aprendizaje y regulación del apetito. Una noche corta puede aumentar cansancio y hacer más difícil cocinar o entrenar, sin que eso sea falta de voluntad.", "Una rutina simple —horario relativamente estable, menos pantallas al final y cena que no genere malestar— puede ayudar, aunque el insomnio persistente necesita evaluación."],
    whyItMatters: "Mirar solo la comida deja afuera una parte central del rendimiento y la salud.",
    examples: ["Preparar el desayuno la noche anterior", "Evitar exceso de mate muy tarde si afecta el sueño", "Cenar con margen si acostarte lleno te molesta"],
    mistakes: ["Compensar cansancio con más cafeína todo el día", "Culparse por tener más hambre", "Usar suplementos sedantes sin consulta"],
    application: "Identificá una barrera de sueño que sí podés modificar esta semana.",
    challenge: "Repetí una rutina breve de cierre durante cinco noches.",
    keyPoints: ["Sueño y alimentación se relacionan", "La cafeína puede interferir", "Los problemas persistentes requieren consulta"], professionalWarning: commonWarning,
  },
  {
    id: "eating-out", category: "Comer fuera de casa", title: "Comer fuera sin abandonar tus hábitos", format: "Guía rápida", durationMinutes: 6, level: "Inicial", tags: ["restaurante", "social", "flexibilidad"], objectiveTags: ["GENERAL", "FAT_LOSS", "MUSCLE_GAIN"],
    summary: "Decisiones flexibles para restaurantes, reuniones y comidas al paso.",
    explanation: ["Comer afuera forma parte de la vida. Podés mirar hambre, elegir una preparación que disfrutes y sumar una estructura conocida cuando esté disponible, sin exigir control total.", "Si sabés que la comida será tarde, una colación previa puede evitar hambre extrema. Compartir, dejar comida o pedir más son opciones, no reglas."],
    whyItMatters: "La habilidad de adaptarse protege la vida social y la continuidad a largo plazo.",
    examples: ["Sándwich completo y agua", "Parrilla con guarnición elegida", "Pizza compartida con una ensalada si te resulta útil", "Empanadas y fruta más tarde"],
    mistakes: ["Llegar con hambre extrema para ahorrar", "Buscar la opción perfecta", "Compensar al día siguiente"],
    application: "Antes de una salida, decidí solo una ancla: no llegar con hambre extrema o mantener hidratación.",
    challenge: "Disfrutá una comida social y retomá después sin castigo.",
    keyPoints: ["La flexibilidad es una habilidad", "No hay que compensar", "El contexto social también importa"],
  },
];

function normalizedObjective(value: string) {
  const objective = value.toLocaleLowerCase("es");
  if (objective.includes("masa") || objective.includes("músculo") || objective.includes("musculo") || objective.includes("volumen")) return "MUSCLE_GAIN" as const;
  if (objective.includes("grasa") || objective.includes("bajar") || objective.includes("peso")) return "FAT_LOSS" as const;
  if (objective.includes("rend") || objective.includes("fuerza") || objective.includes("deport")) return "PERFORMANCE" as const;
  return "GENERAL" as const;
}

export function educationPriority(item: NutritionEducationItem, objective: string, completed: boolean) {
  const target = normalizedObjective(objective);
  return (item.objectiveTags.includes(target) ? 20 : item.objectiveTags.includes("GENERAL") ? 8 : 0) - (completed ? 100 : 0);
}

export function quizResult(contentId: string, questionId: string, selectedAnswer: number) {
  const quiz = NUTRITION_EDUCATION.find((item) => item.id === contentId)?.quiz;
  if (!quiz || quiz.id !== questionId || !Number.isInteger(selectedAnswer) || selectedAnswer < 0 || selectedAnswer >= quiz.options.length) return null;
  return { correct: selectedAnswer === quiz.correctAnswer, explanation: quiz.explanation };
}
