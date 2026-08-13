export function numericDraftValue(rawValue: string): number | null {
  if (rawValue === "") return null;
  const value = Number(rawValue);
  return Number.isFinite(value) ? value : null;
}

export function repetitionRangeDraft(repetitions: string) {
  const values = repetitions.match(/\d+/g) ?? [];
  return {
    minimum: values[0] ?? "",
    maximum: values[1] ?? values[0] ?? "",
  };
}

export function serializedRepetitionRange(minimum: string, maximum: string) {
  if (!minimum || !maximum) return null;
  return minimum === maximum ? minimum : `${minimum}-${maximum}`;
}
