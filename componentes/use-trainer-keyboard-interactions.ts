"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { shouldEnterAdvance } from "@/lib/trainer-keyboard-interactions";
import { registerEscapeLayer } from "@/lib/trainer-escape-layers";

const enterFieldSelector = 'input:not([disabled]):not([data-enter-next="false"]), select:not([disabled]):not([data-enter-next="false"])';

export function useEnterFieldNavigation() {
  return useCallback((event: ReactKeyboardEvent<HTMLFormElement>) => {
    if (event.key !== "Enter" || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.nativeEvent.isComposing) return;
    const target = event.target;
    if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
    if (target.dataset.enterNext === "false") return;
    if (!shouldEnterAdvance({ tagName: target.tagName, inputType: target instanceof HTMLInputElement ? target.type : undefined, hasList: target instanceof HTMLInputElement && Boolean(target.getAttribute("list")), disabled: target.disabled })) return;

    const fields = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(enterFieldSelector))
      .filter((field) => field.getClientRects().length > 0 && field.tabIndex !== -1);
    const currentIndex = fields.indexOf(target);
    if (currentIndex < 0) return;

    event.preventDefault();
    const next = fields.slice(currentIndex + 1).find((field) => shouldEnterAdvance({
      tagName: field.tagName,
      inputType: field instanceof HTMLInputElement ? field.type : undefined,
      hasList: field instanceof HTMLInputElement && Boolean(field.getAttribute("list")),
      disabled: "disabled" in field ? Boolean(field.disabled) : false,
    }));
    next?.focus({ preventScroll: true });
    next?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, []);
}

export function useEscapeLayer(active: boolean, dismiss: () => void, { priority = 0, triggerRef }: { priority?: number; triggerRef?: RefObject<HTMLElement | null> } = {}) {
  const dismissRef = useRef(dismiss);
  useEffect(() => { dismissRef.current = dismiss; }, [dismiss]);
  useEffect(() => {
    if (!active) return;
    const restoreFocus = triggerRef?.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    return registerEscapeLayer({ dismiss: () => dismissRef.current(), priority, restoreFocus });
  }, [active, priority, triggerRef]);
}
