export function localNutritionAnswer(question: string) {
  const normalized = question.toLocaleLowerCase("es");
  return /qu[eé] es (la )?prote[ií]na|para qu[eé] sirve (la )?prote[ií]na/.test(normalized)
    ? "La proteína es un nutriente que ayuda a construir y reparar tejidos, incluidos los músculos. Podés encontrarla en huevos, legumbres, lácteos, carnes o soja. La cantidad que necesitás depende de tu situación individual."
    : /antes de entrenar|preentrenamiento/.test(normalized)
      ? "Si vas a entrenar dentro de una hora, elegí una porción pequeña de algo conocido y fácil de digerir, como una banana o una tostada, siempre que lo toleres. Ajustá la cantidad según tu apetito y el tipo de entrenamiento."
      : /hidrataci[oó]n|hidratar/.test(normalized)
        ? "Tomá agua durante el día y llevá una botella al entrenamiento. La cantidad necesaria varía con el calor, la duración y tu sudoración."
        : "Este modo ofrece orientación general y no puede interpretar bien todas las preguntas libres. Podés explorar recetas, organizar tu plan, revisar hábitos o consultar a tu entrenador para una respuesta personalizada.";
}
