"use client";

import { useCallback, useEffect, useId, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { routineBlockDropIndex, routineBlockScrollSpeed } from "@/lib/routine-block-reorder";

type SortableBlock = { clientId: string; name: string; order: number };
type DragSession = {
  id: string;
  pointerId: number;
  handle: HTMLButtonElement;
  startX: number;
  startY: number;
  y: number;
  offsetY: number;
  left: number;
  width: number;
  accent: string;
  active: boolean;
  target: number;
  timer?: ReturnType<typeof setTimeout>;
  frame?: number;
  lastFrame?: number;
  scrollParent: HTMLElement | null;
};
type DragPreview = { id: string; top: number; left: number; width: number; accent: string; target: number };

function scrollParentOf(element: HTMLElement): HTMLElement | null {
  let parent = element.parentElement;
  while (parent) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
    parent = parent.parentElement;
  }
  return null;
}

/** A handle-only pointer gesture; the draft changes once, on drop, never on hover. */
export function RoutineBlockSorter<T extends SortableBlock>({ blocks, disabled = false, reorder, renderBlock, className = "mt-4 space-y-2" }: {
  blocks: T[];
  disabled?: boolean;
  reorder: (clientId: string, targetIndex: number) => void;
  renderBlock: (block: T, handle: ReactNode) => ReactNode;
  className?: string;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<DragSession | null>(null);
  const callbacksRef = useRef({ blocks, reorder, disabled });
  const [preview, setPreview] = useState<DragPreview | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const instructionsId = useId();
  const ordered = [...blocks].sort((a, b) => a.order - b.order);

  useEffect(() => { callbacksRef.current = { blocks, reorder, disabled }; }, [blocks, reorder, disabled]);

  const clearSession = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (!session) return;
    clearTimeout(session.timer);
    if (session.frame !== undefined) cancelAnimationFrame(session.frame);
    if (session.handle.hasPointerCapture(session.pointerId)) session.handle.releasePointerCapture(session.pointerId);
  }, []);

  const cancelDrag = useCallback(() => {
    if (!sessionRef.current) return;
    clearSession();
    setPreview(null);
    setAnnouncement("Movimiento cancelado. El orden no cambió.");
  }, [clearSession]);

  useEffect(() => {
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || !sessionRef.current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelDrag();
    };
    const onBlur = () => cancelDrag();
    document.addEventListener("keydown", onEscape, true);
    window.addEventListener("blur", onBlur);
    return () => {
      clearSession();
      document.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("blur", onBlur);
    };
  }, [cancelDrag, clearSession]);

  function updatePreview(session: DragSession) {
    const otherCards = Array.from(listRef.current?.children ?? [])
      .filter((element) => (element as HTMLElement).dataset.routineBlockId && (element as HTMLElement).dataset.routineBlockId !== session.id);
    session.target = routineBlockDropIndex(session.y, otherCards.map((element) => element.getBoundingClientRect()));
    setPreview({ id: session.id, target: session.target, top: Math.max(8, Math.min(window.innerHeight - 84, session.y - session.offsetY)), left: session.left, width: session.width, accent: session.accent });
  }

  function activateDrag(session: DragSession) {
    if (sessionRef.current !== session || session.active || callbacksRef.current.disabled) return;
    session.active = true;
    clearTimeout(session.timer);
    updatePreview(session);
    const tick = (time: number) => {
      if (sessionRef.current !== session) return;
      const bounds = session.scrollParent?.getBoundingClientRect();
      // Leave space for the editor's sticky heading and save bar.
      const top = Math.max(0, bounds?.top ?? 0) + 88;
      const bottom = Math.min(window.innerHeight, bounds?.bottom ?? window.innerHeight) - 88;
      const elapsed = session.lastFrame === undefined ? 1 : Math.min(2, (time - session.lastFrame) / 16.67);
      session.lastFrame = time;
      const speed = routineBlockScrollSpeed(session.y, top, bottom) * elapsed;
      if (speed) {
        if (session.scrollParent) session.scrollParent.scrollTop += speed;
        else window.scrollBy(0, speed);
        updatePreview(session);
      }
      session.frame = requestAnimationFrame(tick);
    };
    session.frame = requestAnimationFrame(tick);
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>, block: T, index: number) {
    if (disabled || blocks.length < 2 || !event.isPrimary || event.button !== 0 || sessionRef.current) return;
    const handle = event.currentTarget;
    const card = handle.closest<HTMLElement>("[data-routine-block-id]");
    if (!card) return;
    const bounds = card.getBoundingClientRect();
    handle.setPointerCapture(event.pointerId);
    const session: DragSession = { id: block.clientId, pointerId: event.pointerId, handle, startX: event.clientX, startY: event.clientY, y: event.clientY, offsetY: Math.min(36, event.clientY - bounds.top), left: bounds.left, width: bounds.width, accent: getComputedStyle(card).getPropertyValue("--bm-accent").trim(), target: index, active: false, scrollParent: scrollParentOf(card) };
    sessionRef.current = session;
    // Touch can pick up on a short hold; mouse also picks up after a small movement.
    if (event.pointerType !== "mouse") session.timer = setTimeout(() => activateDrag(session), 180);
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    session.y = event.clientY;
    if (!session.active && Math.hypot(event.clientX - session.startX, event.clientY - session.startY) >= 6) activateDrag(session);
    if (session.active) { event.preventDefault(); updatePreview(session); }
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const session = sessionRef.current;
    if (!session || session.pointerId !== event.pointerId) return;
    if (session.active) { session.y = event.clientY; updatePreview(session); }
    const { active, id, target, handle } = session;
    clearSession();
    setPreview(null);
    if (!active || callbacksRef.current.disabled) return;
    callbacksRef.current.reorder(id, target);
    setAnnouncement(`Bloque en posición ${target + 1} de ${callbacksRef.current.blocks.length}.`);
    requestAnimationFrame(() => { if (handle.isConnected) handle.focus({ preventScroll: true }); });
  }

  function keyboardMove(event: KeyboardEvent<HTMLButtonElement>, block: T, index: number) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    event.stopPropagation();
    if (disabled || sessionRef.current) return;
    const target = event.key === "Home" ? 0 : event.key === "End" ? ordered.length - 1 : index + (event.key === "ArrowUp" ? -1 : 1);
    if (target < 0 || target >= ordered.length || target === index) return;
    reorder(block.clientId, target);
    setAnnouncement(`${block.name || "Bloque"}, posición ${target + 1} de ${ordered.length}.`);
  }

  const otherBlocks = ordered.filter((block) => block.clientId !== preview?.id);
  const destinationId = preview ? otherBlocks[preview.target]?.clientId : undefined;
  const afterId = preview && preview.target === otherBlocks.length ? otherBlocks.at(-1)?.clientId : undefined;
  const selected = ordered.find((block) => block.clientId === preview?.id);

  return <>
    <p id={instructionsId} className="sr-only">Mantené presionado el agarre y arrastrá para reordenar dentro del día. Con teclado, usá flecha arriba o abajo; Inicio y Fin. Escape cancela el arrastre.</p>
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">{preview ? `Moviendo ${selected?.name || "bloque"}. Posición de destino ${preview.target + 1} de ${ordered.length}.` : announcement}</p>
    <div ref={listRef} className={className}>
      {ordered.map((block, index) => <div id={`routine-block-${block.clientId}`} key={block.clientId} data-routine-block-id={block.clientId} data-drag-selected={preview?.id === block.clientId || undefined} data-drop-before={destinationId === block.clientId || undefined} data-drop-after={afterId === block.clientId || undefined} className="routine-sortable-block">
        {renderBlock(block, <button type="button" aria-label={`Reordenar bloque ${block.name || "sin nombre"}, posición ${index + 1} de ${ordered.length}`} aria-describedby={instructionsId} disabled={disabled || ordered.length < 2} className="routine-block-drag-handle" onPointerDown={(event) => startDrag(event, block, index)} onPointerMove={moveDrag} onPointerUp={finishDrag} onPointerCancel={cancelDrag} onLostPointerCapture={cancelDrag} onKeyDown={(event) => keyboardMove(event, block, index)}>
          <svg aria-hidden="true" width="20" height="24" viewBox="0 0 20 24" fill="currentColor">{[6, 12, 18].flatMap((y) => [7, 13].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.7" />))}</svg>
        </button>)}
      </div>)}
    </div>
    {preview && createPortal(<div aria-hidden="true" className="workspace-brand routine-block-drag-preview" style={{ top: preview.top, left: preview.left, width: preview.width, "--bm-accent": preview.accent } as CSSProperties}><strong>{selected?.name || "Bloque sin nombre"}</strong><span>Posición {preview.target + 1} de {ordered.length}</span></div>, document.body)}
  </>;
}
