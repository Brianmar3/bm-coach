"use client";

import { useEffect, type KeyboardEvent, type RefObject } from "react";
import { availableControls, revealOption } from "@/lib/keyboard-navigation";
import { useEscapeLayer } from "@/componentes/use-trainer-keyboard-interactions";

/** Opt-in results only: text, native selects, dates, numbers and editor controls are untouched. */
export function useResultNavigation(root: RefObject<HTMLElement | null>, search: RefObject<HTMLInputElement | null>, selector = "[data-keyboard-result]") {
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !root.current) return;
    const target = event.target as HTMLElement;
    const fromSearch = target === search.current;
    const fromResult = target.matches(selector);
    if (!fromSearch && !fromResult) return;
    if (fromSearch && event.key === "Enter") { event.preventDefault(); return; }
    if (fromSearch && target.getAttribute("aria-busy") === "true") return;
    if (fromResult && event.key === "Escape" && search.current) {
      event.preventDefault(); event.stopPropagation(); search.current?.focus({ preventScroll: true }); return;
    }
    if (!["ArrowDown", "ArrowUp", ...(fromResult ? ["Home", "End"] : [])].includes(event.key)) return;
    const controls = availableControls(root.current, selector);
    if (!controls.length) return;
    const current = controls.indexOf(target);
    const index = event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1
      : current < 0 ? event.key === "ArrowDown" ? 0 : controls.length - 1
      : Math.max(0, Math.min(controls.length - 1, current + (event.key === "ArrowDown" ? 1 : -1)));
    event.preventDefault(); event.stopPropagation();
    controls[index]?.focus();
    revealOption(root.current, controls[index] ?? null);
  };
}

export function useMenuNavigation(menu: RefObject<HTMLElement | null>, trigger: RefObject<HTMLButtonElement | null>, open: boolean, close: () => void, ready = true) {
  useEscapeLayer(open && ready, close, { priority: 90, triggerRef: trigger });
  useEffect(() => {
    if (!open || !ready) return;
    const frame = requestAnimationFrame(() => { if (menu.current) availableControls(menu.current, '[role="menuitem"]')[0]?.focus({ preventScroll: true }); });
    return () => cancelAnimationFrame(frame);
  }, [menu, open, ready]);
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey || !menu.current) return;
    if (event.key === "Escape" || event.key === "Tab") {
      if (event.key === "Escape") event.preventDefault();
      event.stopPropagation(); trigger.current?.focus({ preventScroll: true }); close(); return;
    }
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    const controls = availableControls(menu.current, '[role="menuitem"]');
    const current = controls.indexOf(event.target as HTMLElement);
    const index = event.key === "Home" ? 0 : event.key === "End" ? controls.length - 1
      : (current + (event.key === "ArrowDown" ? 1 : -1) + controls.length) % controls.length;
    event.preventDefault(); event.stopPropagation();
    controls[index]?.focus({ preventScroll: true }); revealOption(menu.current, controls[index] ?? null);
  };
}
