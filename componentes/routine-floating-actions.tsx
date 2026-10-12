"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

/** Portalled so card overflow and stacking contexts cannot clip actions. */
export function RoutineFloatingActions({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null), panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });
  function close() { setOpen(false); anchor.current?.focus({ preventScroll: true }); }
  useLayoutEffect(() => {
    if (!open) return;
    function position() {
      if (!anchor.current || !panel.current) return;
      const a = anchor.current.getBoundingClientRect(), v = window.visualViewport;
      const left = v?.offsetLeft ?? 0, top = v?.offsetTop ?? 0, width = v?.width ?? innerWidth, height = v?.height ?? innerHeight;
      const below = top + height - a.bottom - 16, above = a.top - top - 16;
      const h = Math.min(panel.current.scrollHeight, Math.max(above, below), height - 16);
      const w = Math.min(256, width - 16);
      const theme = getComputedStyle(anchor.current);
      const variables = Object.fromEntries(["--bm-accent", "--brand-text", "--background", "--foreground", "--foreground-muted", "--surface", "--surface-soft", "--border-soft"].map(key => [key, theme.getPropertyValue(key)]));
      setStyle({ ...variables, position: "fixed", width: w, maxHeight: Math.max(44, h), left: Math.max(left + 8, Math.min(a.right - w, left + width - w - 8)), top: Math.max(top + 8, below >= panel.current.scrollHeight || below >= above ? a.bottom + 6 : a.top - h - 6), visibility: "visible" });
    }
    position(); panel.current?.querySelector<HTMLElement>("button,select")?.focus({ preventScroll: true });
    window.addEventListener("resize", position); document.addEventListener("scroll", position, true);
    window.visualViewport?.addEventListener("resize", position);
    return () => { window.removeEventListener("resize", position); document.removeEventListener("scroll", position, true); window.visualViewport?.removeEventListener("resize", position); };
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => { if (!panel.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) setOpen(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); close(); } };
    document.addEventListener("pointerdown", outside, true); document.addEventListener("keydown", escape, true);
    return () => { document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", escape, true); };
  }, [open]);
  return <><button ref={anchor} type="button" aria-label="Acciones del bloque" aria-expanded={open} aria-controls={open ? id : undefined} aria-haspopup="dialog" className="grid size-11 place-items-center rounded bg-zinc-800 text-lg" onClick={() => setOpen(value => !value)}>⋮</button>{open && createPortal(<div ref={panel} id={id} role="dialog" aria-label="Acciones del bloque" className="routine-floating-actions" style={style} onClick={event => { if ((event.target as HTMLElement).closest("button")) close(); }} onChange={close} onKeyDown={event => {
    if (event.key !== "Tab") return;
    const targets = [...(panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled),select:not(:disabled)") ?? [])];
    if (event.shiftKey && document.activeElement === targets[0]) { event.preventDefault(); targets.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === targets.at(-1)) { event.preventDefault(); targets[0]?.focus(); }
  }}>{children}</div>, document.body)}</>;
}
