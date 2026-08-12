"use client";

import { useCallback, type KeyboardEvent } from "react";
import { routineArrowDirection, routineControlNeedsScroll } from "@/lib/routine-keyboard-navigation";

const navigableControlSelector = 'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])';

export function useRoutineKeyboardNavigation() {
  return useCallback((event: KeyboardEvent<HTMLFormElement>) => {
    if (event.defaultPrevented || event.isDefaultPrevented() || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement)) return;

    const direction = routineArrowDirection(event.key, {
      tagName: target.tagName,
      inputType: target instanceof HTMLInputElement ? target.type : undefined,
      hasList: target instanceof HTMLInputElement && Boolean(target.getAttribute("list")),
      selectionStart: "selectionStart" in target ? target.selectionStart : null,
      selectionEnd: "selectionEnd" in target ? target.selectionEnd : null,
      valueLength: target.value.length,
    });
    if (direction === null) return;

    const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(navigableControlSelector))
      .filter((control) => control.getClientRects().length > 0 && control.tabIndex !== -1);
    const currentIndex = controls.indexOf(target);
    const nextControl = controls[currentIndex + direction];
    if (currentIndex < 0 || !nextControl) return;

    event.preventDefault();
    nextControl.focus({ preventScroll: true });
    const rect = nextControl.getBoundingClientRect();
    if (routineControlNeedsScroll(rect, { width: window.innerWidth, height: window.innerHeight })) {
      nextControl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, []);
}
