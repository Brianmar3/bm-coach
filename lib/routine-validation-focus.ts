export function focusRoutineValidationField(key: string, root: ParentNode = document, viewportHeight = window.innerHeight) {
  const escapedKey = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(key) : key.replace(/["\\]/g, "\\$&");
  const target = root.querySelector<HTMLElement>(`[data-validation-key="${escapedKey}"]`);
  if (!target) return false;
  target.focus({ preventScroll: true });
  const bounds = target.getBoundingClientRect();
  if (bounds.top < 88 || bounds.bottom > viewportHeight - 72) target.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}
