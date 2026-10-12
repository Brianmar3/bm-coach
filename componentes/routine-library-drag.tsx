"use client";

import { createContext, useContext, useEffect, useRef, useState, type DragEvent, type ReactNode } from "react";
import type { BMExercise } from "@/types/exercise-library";
import type { TrainingLibraryBlock } from "@/types/training-library";

export type LibraryCopy = { kind: "block"; block: TrainingLibraryBlock } | { kind: "exercise"; exercise: BMExercise };
type Source = { kind: LibraryCopy["kind"]; title: string; resolve: (signal: AbortSignal) => Promise<LibraryCopy>; done?: () => void };
type Session = { source: Source; consumed: boolean };
const Context = createContext<{ kind: Source["kind"] | null; busy: boolean; start: (event: DragEvent, source: Source) => void; end: () => void; drop: (kind: Source["kind"], insert: (copy: LibraryCopy) => boolean) => void } | null>(null);

export function RoutineLibraryDrag({ children }: { children: ReactNode }) {
  const [kind, setKind] = useState<Source["kind"] | null>(null), [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const session = useRef<Session | null>(null), pending = useRef<AbortController | null>(null);
  const ghost = useRef<HTMLElement | null>(null);
  function end() { session.current = null; setKind(null); ghost.current?.remove(); ghost.current = null; }
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(""), 2600); return () => clearTimeout(timer); }, [message]);
  useEffect(() => {
    let frame = 0, y = 0, x = 0, active = false;
    function tick() {
      if (!active) return;
      const element = document.elementFromPoint(x, y);
      let scroll = element instanceof HTMLElement ? element : null;
      while (scroll && !(scroll.scrollHeight > scroll.clientHeight && /auto|scroll/.test(getComputedStyle(scroll).overflowY))) scroll = scroll.parentElement;
      if (scroll) { const r = scroll.getBoundingClientRect(); const top = Math.max(r.top, 90), bottom = Math.min(r.bottom, innerHeight); const speed = y < top + 70 ? -Math.min(14, (top + 70 - y) / 5) : y > bottom - 70 ? Math.min(14, (y - bottom + 70) / 5) : 0; scroll.scrollTop += speed; }
      frame = requestAnimationFrame(tick);
    }
    const over = (event: globalThis.DragEvent) => { if (!session.current) return; x = event.clientX; y = event.clientY; if (!active) { active = true; tick(); } };
    const stop = () => { active = false; cancelAnimationFrame(frame); };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape" && session.current) { event.preventDefault(); event.stopImmediatePropagation(); end(); stop(); } };
    document.addEventListener("dragover", over, true); document.addEventListener("dragend", stop); document.addEventListener("drop", stop); document.addEventListener("keydown", escape, true);
    return () => { stop(); pending.current?.abort(); ghost.current?.remove(); document.removeEventListener("dragover", over, true); document.removeEventListener("dragend", stop); document.removeEventListener("drop", stop); document.removeEventListener("keydown", escape, true); };
  }, []);
  return <Context.Provider value={{ kind, busy: loading || kind !== null, end, start(event, source) {
    if (pending.current || !window.matchMedia("(min-width: 1024px) and (pointer: fine)").matches) { event.preventDefault(); return; }
    session.current = { source, consumed: false }; setKind(source.kind);
    event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData("application/x-bm-library-copy", source.kind);
    const preview = document.createElement("div"); preview.className = "routine-library-copy-ghost"; preview.textContent = `+ ${source.title}`; preview.style.setProperty("--bm-accent", getComputedStyle(event.currentTarget).getPropertyValue("--bm-accent")); document.body.append(preview); ghost.current = preview; event.dataTransfer.setDragImage(preview, 16, 16);
  }, drop(expected, insert) {
    const current = session.current;
    if (!current || current.consumed || current.source.kind !== expected || pending.current) return;
    current.consumed = true; const controller = new AbortController(); pending.current = controller; setLoading(true); end();
    void current.source.resolve(controller.signal).then(copy => { if (!controller.signal.aborted && insert(copy)) { current.source.done?.(); setMessage("Agregado a la rutina"); } }).catch(() => { if (!controller.signal.aborted) setMessage("No se pudo agregar. Intentá nuevamente."); }).finally(() => { if (pending.current === controller) { pending.current = null; setLoading(false); } });
  } }}>{children}<p role="status" className={message ? "routine-copy-feedback" : "sr-only"}>{message}</p></Context.Provider>;
}

export function LibraryDragHandle({ source, disabled = false }: { source: Source; disabled?: boolean }) {
  const context = useContext(Context);
  if (!context) return null;
  return <button type="button" draggable={!disabled} disabled={disabled} className="routine-library-copy-handle" aria-label={`Arrastrar copia: ${source.title}`} title="Arrastrar una copia a la rutina" onDragStart={event => context.start(event, source)} onDragEnd={context.end} onClick={event => { event.preventDefault(); event.stopPropagation(); }}><svg width="18" height="22" viewBox="0 0 18 22" fill="currentColor" aria-hidden="true">{[5, 11, 17].flatMap(y => [6, 12].map(x => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5"/>))}</svg></button>;
}

export function LibraryDropZone({ kind, insert, label, disabled = false }: { kind: Source["kind"]; insert: (copy: LibraryCopy) => void; label: string; disabled?: boolean }) {
  const context = useContext(Context), ref = useRef<HTMLDivElement>(null), latest = useRef(insert);
  const [over, setOver] = useState(false);
  useEffect(() => { latest.current = insert; });
  const enabled = context?.kind === kind && !disabled;
  return <div ref={ref} data-library-drop={kind} data-drop-label={label} data-enabled={enabled || undefined} data-over={enabled && over || undefined} className="routine-library-drop" onDragOver={event => { if (enabled) { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "copy"; setOver(true); } }} onDragLeave={() => setOver(false)} onDrop={event => { if (!enabled) return; event.preventDefault(); event.stopPropagation(); setOver(false); context?.drop(kind, copy => { if (!ref.current?.isConnected || ref.current.closest("fieldset:disabled")) return false; latest.current(copy); return true; }); }}>{enabled && <span>Soltar para agregar · {label}</span>}</div>;
}

export function useLibraryCopyBusy() { return useContext(Context)?.busy ?? false; }
