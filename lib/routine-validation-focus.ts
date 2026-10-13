export function focusRoutineValidationField(key: string, root: ParentNode = document, viewportHeight = window.innerHeight) {
  const escapedKey = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(key) : key.replace(/["\\]/g, "\\$&");
  const locationKey = key.replace(/\.[^.]+$/, "");
  const target = root.querySelector<HTMLElement>(`[data-validation-key="${escapedKey}"]`) ?? root.querySelector<HTMLElement>(`[data-review-key="${locationKey}"]`) ?? root.querySelector<HTMLElement>("[data-review-routine]");
  if (!target) return false;
  let parent = target.parentElement;
  while (parent) { if (parent instanceof HTMLDetailsElement) parent.open = true; parent = parent.parentElement; }
  target.focus({ preventScroll: true });
  if (target.classList) {
    target.classList.add("routine-validation-flash");
    window.setTimeout(() => target.classList.remove("routine-validation-flash"), 1800);
  }
  const bounds = target.getBoundingClientRect();
  if (bounds.top < 88 || bounds.bottom > viewportHeight - 72) target.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}
