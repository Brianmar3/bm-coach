"use client";

import { useRef, type ReactNode } from "react";
import { useResultNavigation } from "@/componentes/use-result-navigation";
import { closeFocusedDisclosure } from "@/lib/keyboard-navigation";

/** A local scope, enabled only by explicit data attributes on a search and its primary results. */
export function KeyboardResults({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const keyboard = useResultNavigation(root, search);
  return <div ref={root} className="contents" onKeyDown={event => {
    if (event.defaultPrevented) return;
    if (event.key === "Escape" && !event.nativeEvent.isComposing && closeFocusedDisclosure(event.target, root.current)) {
      event.preventDefault(); event.stopPropagation(); return;
    }
    const target = event.target as HTMLElement;
    if (target.matches('input[data-keyboard-results-search]')) search.current = target as HTMLInputElement;
    else if (target.matches('[data-keyboard-result]') && !search.current?.isConnected) {
      search.current = Array.from(root.current?.querySelectorAll<HTMLInputElement>('input[data-keyboard-results-search]') ?? []).find(input => input.getClientRects().length > 0) ?? null;
    }
    keyboard(event);
  }}>{children}</div>;
}
