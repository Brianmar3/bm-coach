export type RoutineArrowDirection = -1 | 1;

export type RoutineKeyboardTarget = {
  tagName: string;
  inputType?: string;
  hasList?: boolean;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  valueLength?: number;
};

const forwardKeys = new Set(["ArrowRight", "ArrowDown"]);
const backwardKeys = new Set(["ArrowLeft", "ArrowUp"]);
const nativeArrowInputTypes = new Set(["date", "datetime-local", "month", "time", "week", "range", "color", "radio"]);

export function routineArrowDirection(key: string, target: RoutineKeyboardTarget): RoutineArrowDirection | null {
  const direction: RoutineArrowDirection | null = forwardKeys.has(key) ? 1 : backwardKeys.has(key) ? -1 : null;
  if (direction === null) return null;

  const tagName = target.tagName.toUpperCase();
  if (tagName === "SELECT") return key === "ArrowUp" || key === "ArrowDown" ? null : direction;

  const inputType = target.inputType?.toLowerCase() ?? "text";
  if (tagName === "INPUT" && nativeArrowInputTypes.has(inputType)) return null;
  if (tagName === "INPUT" && inputType === "number" && (key === "ArrowUp" || key === "ArrowDown")) return null;
  if (tagName === "INPUT" && target.hasList && (key === "ArrowUp" || key === "ArrowDown")) return null;

  const textControl = tagName === "TEXTAREA" || (tagName === "INPUT" && !["number", "checkbox"].includes(inputType));
  if (!textControl) return direction;

  const selectionStart = target.selectionStart ?? 0;
  const selectionEnd = target.selectionEnd ?? selectionStart;
  if (selectionStart !== selectionEnd) return null;
  const valueLength = target.valueLength ?? 0;

  if (key === "ArrowRight") return selectionEnd === valueLength ? 1 : null;
  if (key === "ArrowLeft") return selectionStart === 0 ? -1 : null;
  if (tagName === "TEXTAREA") {
    if (key === "ArrowDown") return selectionEnd === valueLength ? 1 : null;
    if (key === "ArrowUp") return selectionStart === 0 ? -1 : null;
  }
  return direction;
}

export function routineControlNeedsScroll(rect: { top: number; right: number; bottom: number; left: number }, viewport: { width: number; height: number }, margin = 12) {
  return rect.top < margin || rect.left < margin || rect.bottom > viewport.height - margin || rect.right > viewport.width - margin;
}
