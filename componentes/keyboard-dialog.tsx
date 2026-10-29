"use client";

import { useEffect, useRef, type FormEventHandler, type HTMLAttributes, type KeyboardEvent, type RefObject } from "react";
import { availableControls, closeFocusedDisclosure } from "@/lib/keyboard-navigation";
import { useEscapeLayer } from "@/componentes/use-trainer-keyboard-interactions";

export function preventImplicitSubmit(event: KeyboardEvent<HTMLElement>) {
  if (event.defaultPrevented || event.key !== "Enter" || event.nativeEvent.isComposing || event.keyCode === 229 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
  const target = event.target;
  if (target instanceof HTMLInputElement && !target.hasAttribute("list") &&
    ["text", "search", "email", "tel", "url", "password", "number"].includes(target.type)) event.preventDefault();
}

export function useDialogKeyboard(ref: RefObject<HTMLElement | null>, active: boolean, close: () => void, { priority = 80, dismissible = true, autoFocus = true, modal = true }: { priority?: number; dismissible?: boolean; autoFocus?: boolean; modal?: boolean } = {}) {
  // Keep a busy modal in the Escape stack, so Escape cannot dismiss the layer below it.
  useEscapeLayer(active, () => { if (dismissible) close(); }, { priority, restoreFocus: false });
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    const frame = requestAnimationFrame(() => {
      if (autoFocus && ref.current && !ref.current.contains(document.activeElement)) (availableControls(ref.current)[0] ?? ref.current).focus({ preventScroll: true });
    });
    return () => {
      cancelAnimationFrame(frame);
      if (dialog?.contains(document.activeElement) || document.activeElement === document.body) {
        requestAnimationFrame(() => { if (previous?.isConnected && !previous.matches(":disabled")) previous.focus({ preventScroll: true }); });
      }
    };
  }, [active, autoFocus, ref]);
  return (event: KeyboardEvent<HTMLElement>) => {
    if (event.defaultPrevented) return;
    if (event.key === "Escape" && !event.nativeEvent.isComposing && closeFocusedDisclosure(event.target, ref.current)) {
      event.preventDefault(); event.stopPropagation(); return;
    }
    preventImplicitSubmit(event);
    if (event.key !== "Tab" || !ref.current || !modal) return;
    const nested = (event.target as HTMLElement).closest('[role="dialog"][aria-modal="true"], [role="alertdialog"][aria-modal="true"]');
    if (nested && nested !== ref.current && ref.current.contains(nested)) return;
    const controls = availableControls(ref.current);
    const first = controls[0]; const last = controls.at(-1);
    if (!first) { event.preventDefault(); ref.current.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (document.activeElement === last || document.activeElement === ref.current)) { event.preventDefault(); first.focus(); }
  };
}

/** Preserves the existing element, layout and callbacks; adds only dialog keyboard behavior. */
export function KeyboardDialog({ as = "div", onClose, dismissible = true, priority = 80, modal = true, role = "dialog", onKeyDown, onSubmit, ...props }: Omit<HTMLAttributes<HTMLElement>, "onSubmit"> & {
  as?: "div" | "section" | "form"; onClose: () => void; dismissible?: boolean; priority?: number; noValidate?: boolean;
  onSubmit?: FormEventHandler<HTMLFormElement>; modal?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const keyboard = useDialogKeyboard(ref, true, onClose, { priority, dismissible, modal });
  const attributes = { ...props, role, "aria-modal": modal || undefined, tabIndex: -1,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => { onKeyDown?.(event); keyboard(event); } };
  if (as === "form") return <form {...attributes} onSubmit={onSubmit} ref={node => { ref.current = node; }} />;
  if (as === "section") return <section {...attributes} ref={node => { ref.current = node; }} />;
  return <div {...attributes} ref={node => { ref.current = node; }} />;
}
