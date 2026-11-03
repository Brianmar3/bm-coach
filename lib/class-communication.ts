export const CLASS_REACTIONS = [
  { value: "RECEIVED", label: "👍 Recibido" },
  { value: "THANKS", label: "🙌 Gracias por avisar" },
  { value: "SEE_YOU", label: "💪 Nos vemos" },
] as const;
export const CLASS_RATINGS = [
  { value: "EXCELLENT", label: "🔥 Excelente" },
  { value: "GOOD", label: "💪 Buena" },
  { value: "IMPROVE", label: "💬 A mejorar" },
] as const;
export type ClassReaction = typeof CLASS_REACTIONS[number]["value"];
export type ClassRating = typeof CLASS_RATINGS[number]["value"];
export const CLASS_FEEDBACK_PRIVACY = "Tu opinión es privada: sólo tu entrenador puede verla e identificar que la enviaste vos.";

export function feedbackInput(body: unknown) {
  const input = body as { occurrenceId?: unknown; rating?: unknown; comment?: unknown; skip?: unknown } | null;
  if (!input || typeof input.occurrenceId !== "string" || !input.occurrenceId || input.occurrenceId.length > 100) throw new Error("Seleccioná una clase válida.");
  if (input.skip === true) return { occurrenceId: input.occurrenceId, skip: true as const, rating: null, comment: null };
  const rating = CLASS_RATINGS.find(item => item.value === input.rating)?.value;
  if (!rating) throw new Error("Seleccioná una valoración.");
  if (input.comment !== undefined && typeof input.comment !== "string") throw new Error("El comentario no es válido.");
  const comment = (input.comment as string | undefined)?.trim() ?? "";
  if (comment.length > 1000) throw new Error("El comentario no puede superar 1000 caracteres.");
  return { occurrenceId: input.occurrenceId, skip: false as const, rating, comment };
}
