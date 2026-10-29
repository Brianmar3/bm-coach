"use client";

import { type HTMLAttributes, type KeyboardEvent } from "react";
import { revealOption } from "@/lib/keyboard-navigation";

/** Local automatic-activation tabs. Native buttons keep click, touch and Enter behavior. */
export function KeyboardTabs({ children, onKeyDown, ...props }: HTMLAttributes<HTMLDivElement>) {
  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const target = event.target;
    if (!(target instanceof HTMLElement) || target.getAttribute("role") !== "tab" || target.closest('[role="tablist"]') !== event.currentTarget) return;
    const vertical = props["aria-orientation"] === "vertical";
    const keys = vertical ? ["ArrowUp", "ArrowDown"] : ["ArrowLeft", "ArrowRight"];
    if (![...keys, "Home", "End"].includes(event.key)) return;
    // Inactive tabs intentionally have tabindex=-1, so collect their native enabled buttons too.
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')).filter(tab => tab.closest('[role="tablist"]') === event.currentTarget && !tab.matches(':disabled, [aria-disabled="true"]') && !tab.closest('[hidden], [inert], [aria-hidden="true"]') && tab.getClientRects().length > 0);
    if (!tabs.length) return;
    event.preventDefault(); event.stopPropagation();
    const index = tabs.indexOf(target);
    const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === keys[0] ? -1 : 1) + tabs.length) % tabs.length;
    const tab = tabs[next];
    tab.focus({ preventScroll: true }); tab.click();
    if (vertical) revealOption(event.currentTarget, tab);
    else {
      const bounds = event.currentTarget.getBoundingClientRect();
      const option = tab.getBoundingClientRect();
      if (option.left < bounds.left) event.currentTarget.scrollLeft += option.left - bounds.left;
      else if (option.right > bounds.right) event.currentTarget.scrollLeft += option.right - bounds.right;
    }
  }
  return <div {...props} role="tablist" onKeyDown={navigate}>{children}</div>;
}
