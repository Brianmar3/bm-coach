export type KeyboardFieldTarget = {
  tagName?: string;
  inputType?: string;
  hasList?: boolean;
  isContentEditable?: boolean;
  disabled?: boolean;
};

const nativeEnterInputTypes = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

export function shouldEnterAdvance(target: KeyboardFieldTarget) {
  if (target.disabled || target.isContentEditable) return false;
  const tagName = target.tagName?.toUpperCase();
  if (tagName === "TEXTAREA" || tagName === "BUTTON") return false;
  if (tagName === "SELECT") return true;
  if (tagName !== "INPUT" || target.hasList) return false;
  return !nativeEnterInputTypes.has(target.inputType?.toLowerCase() ?? "text");
}

export function nextRosterIndex(current: number, key: string, length: number) {
  if (!length) return -1;
  if (key === "ArrowDown") return Math.min(Math.max(current, 0) + 1, length - 1);
  if (key === "ArrowUp") return Math.max(current < 0 ? 0 : current - 1, 0);
  return current;
}

export function rosterStatusForKey(key: string) {
  const normalized = key.toLocaleLowerCase("es");
  if (key === " " || normalized === "p") return "presente" as const;
  if (normalized === "a") return "ausente" as const;
  if (normalized === "j") return "justificado" as const;
  return null;
}
