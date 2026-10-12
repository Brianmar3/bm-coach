import type { KeyboardEvent } from "react";

/** On phones the drawer covers the canvas, so keep keyboard focus in the visible layer. */
export function routineDrawerKeyboard(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "Tab" || !window.matchMedia("(max-width: 767px)").matches) return;
  const targets = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]')].filter(element => element.getClientRects().length);
  if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets.at(-1)?.focus(); }
  else if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0]?.focus(); }
}
