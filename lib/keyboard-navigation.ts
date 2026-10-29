export function nextEnabledOption(keys: readonly string[], current: string | null, direction: 1 | -1) {
  if (!keys.length) return null;
  const index = current === null ? -1 : keys.indexOf(current);
  if (index < 0) return direction === 1 ? keys[0] : keys[keys.length - 1];
  return keys[Math.max(0, Math.min(keys.length - 1, index + direction))];
}

export const focusableSelector = 'a[href],button,input:not([type="hidden"]),select,textarea,summary,[tabindex]';
export function availableControls(root: HTMLElement, selector = focusableSelector) {
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter((element) =>
    !element.matches(':disabled,[aria-disabled="true"]') && !element.closest('[hidden],[inert],[aria-hidden="true"]') &&
    element.tabIndex >= 0 && element.getClientRects().length > 0 &&
    !element.closest('details:not([open]) > :not(summary)') && getComputedStyle(element).visibility !== "hidden",
  );
}

/** Scroll only the results pane, never the document or the routine canvas. */
export function revealOption(list: HTMLElement | null, option: HTMLElement | null) {
  if (!list || !option) return;
  const pane = list.getBoundingClientRect();
  const item = option.getBoundingClientRect();
  if (item.top < pane.top) list.scrollTop -= pane.top - item.top;
  else if (item.bottom > pane.bottom) list.scrollTop += item.bottom - pane.bottom;
}

export function closeFocusedDisclosure(target: EventTarget | null, root: HTMLElement | null) {
  if (!(target instanceof Element) || !root) return false;
  const details = target.closest<HTMLDetailsElement>("details[open]");
  if (!details || !root.contains(details)) return false;
  details.open = false;
  details.querySelector("summary")?.focus({ preventScroll: true });
  return true;
}
