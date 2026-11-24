"use client";

import { useEffect, useRef, type DragEvent as ReactDragEvent, type TouchEvent as ReactTouchEvent } from "react";

type ActiveDrag = {
  id: string;
  touchId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  active: boolean;
  timer: number;
  frame: number;
  scrollTarget: HTMLElement;
  cancel: () => void;
};

type DragVisual = {
  mode: "touch";
  preview: HTMLElement;
  target: HTMLElement | null;
  previousOutline: string;
  previousOffset: string;
  source: HTMLElement | null;
  previousVisibility: string;
};

export function edgeScrollSpeed(y: number, top: number, bottom: number) {
  const edge = Math.min(72, (bottom - top) / 4);
  if (edge <= 0) return 0;
  if (y < top + edge) return -Math.min(14, 2 + (top + edge - y) / edge * 12);
  if (y > bottom - edge) return Math.min(14, 2 + (y - (bottom - edge)) / edge * 12);
  return 0;
}

function scrollTargetFor(element: HTMLElement) {
  for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    const overflow = getComputedStyle(parent).overflowY;
    if (/(auto|scroll)/.test(overflow) && parent.scrollHeight > parent.clientHeight + 2) return parent;
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
}

function createPreview(element: HTMLElement, cardTarget: boolean): DragVisual {
  const preview = element.cloneNode(true) as HTMLElement;
  const accent = getComputedStyle(element).getPropertyValue("--bm-accent").trim() || "#e7b93d";
  preview.style.setProperty("--bm-accent", accent);
  preview.removeAttribute("id");
  preview.removeAttribute("tabindex");
  preview.setAttribute("aria-hidden", "true");
  preview.setAttribute("data-class-drag-preview", "");
  Object.assign(preview.style, {
    position: "fixed", zIndex: "10000", pointerEvents: "none", boxSizing: "border-box",
    width: `${Math.min(Math.max(element.getBoundingClientRect().width, 200), 260)}px`,
    maxHeight: "170px", overflow: "hidden", opacity: "0.72",
    borderColor: accent, boxShadow: "0 14px 36px rgba(0, 0, 0, 0.6)",
  });
  document.body.appendChild(preview);
  const source = cardTarget ? element : null;
  const previousVisibility = source?.style.visibility ?? "";
  if (source) source.style.visibility = "hidden";
  return { mode: "touch", preview, target: null, previousOutline: "", previousOffset: "", source, previousVisibility };
}

function updateVisual(visual: DragVisual, x: number, y: number, targetAttribute: string) {
  const width = visual.preview.getBoundingClientRect().width || 260;
  const height = visual.preview.getBoundingClientRect().height || 170;
  visual.preview.style.left = `${Math.max(8, Math.min(x + 14, window.innerWidth - width - 8))}px`;
  visual.preview.style.top = `${Math.max(8, Math.min(y - height - 16, window.innerHeight - height - 8))}px`;
  const target = document.elementFromPoint(x, y)?.closest<HTMLElement>(`[${targetAttribute}]`) ?? null;
  if (target === visual.target) {
    if (targetAttribute === "data-plan-card" && target) target.setAttribute("data-class-drop-placement", y < target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2 ? "before" : "after");
    return;
  }
  if (visual.target) {
    visual.target.style.outline = visual.previousOutline;
    visual.target.style.outlineOffset = visual.previousOffset;
    visual.target.removeAttribute("data-class-drop-placement");
  }
  visual.target = target;
  if (target) {
    visual.previousOutline = target.style.outline;
    visual.previousOffset = target.style.outlineOffset;
    target.style.outline = "2px solid var(--bm-accent, #e7b93d)";
    target.style.outlineOffset = "-2px";
  }
  if (targetAttribute === "data-plan-card" && target) target.setAttribute("data-class-drop-placement", y < target.getBoundingClientRect().top + target.getBoundingClientRect().height / 2 ? "before" : "after");
}

function removeVisual(visual: DragVisual) {
  if (visual.target) {
    visual.target.style.outline = visual.previousOutline;
    visual.target.style.outlineOffset = visual.previousOffset;
    visual.target.removeAttribute("data-class-drop-placement");
  }
  if (visual.source) visual.source.style.visibility = visual.previousVisibility;
  visual.preview.remove();
}

export function useTouchClassCopy(onCopy: (id: string, date: string, at: number, y?: number) => void, targetAttribute = "data-plan-day") {
  const drag = useRef<ActiveDrag | null>(null);
  const onCopyRef = useRef(onCopy);
  const suppressClick = useRef(false);
  const visual = useRef<DragVisual | null>(null);
  const mouseTarget = useRef<{ element: HTMLElement; outline: string; offset: string } | null>(null);
  useEffect(() => { onCopyRef.current = onCopy; }, [onCopy]);
  useEffect(() => () => { drag.current?.cancel(); if (visual.current) removeVisual(visual.current); }, []);

  function stopMouse() {
    document.removeEventListener("dragover", moveMouse);
    document.removeEventListener("dragend", stopMouse);
    if (mouseTarget.current) { mouseTarget.current.element.style.outline = mouseTarget.current.outline; mouseTarget.current.element.style.outlineOffset = mouseTarget.current.offset; mouseTarget.current = null; }
  }

  function moveMouse(event: DragEvent) {
    const target = (event.clientX || event.clientY) ? document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>(`[${targetAttribute}]`) ?? null : null;
    if (target === mouseTarget.current?.element) return;
    if (mouseTarget.current) { mouseTarget.current.element.style.outline = mouseTarget.current.outline; mouseTarget.current.element.style.outlineOffset = mouseTarget.current.offset; mouseTarget.current = null; }
    if (target) { mouseTarget.current = { element: target, outline: target.style.outline, offset: target.style.outlineOffset }; target.style.outline = "2px solid var(--bm-accent)"; target.style.outlineOffset = "-2px"; }
  }

  function startMouse(event: ReactDragEvent<HTMLElement>) {
    if (drag.current) { event.preventDefault(); return; }
    stopMouse();
    const rect = event.currentTarget.getBoundingClientRect();
    event.dataTransfer.setDragImage(event.currentTarget, event.clientX - rect.left, event.clientY - rect.top);
    event.dataTransfer.effectAllowed = "copy";
    document.addEventListener("dragover", moveMouse);
    document.addEventListener("dragend", stopMouse);
  }

  function start(event: ReactTouchEvent<HTMLElement>, id: string) {
    if (event.touches.length !== 1) return;
    drag.current?.cancel();
    const element = event.currentTarget;
    const touch = event.touches[0];
    const current: ActiveDrag = {
      id, touchId: touch.identifier, startX: touch.clientX, startY: touch.clientY,
      x: touch.clientX, y: touch.clientY, active: false, timer: 0, frame: 0,
      scrollTarget: scrollTargetFor(element), cancel: () => {},
    };
    const frame = () => {
      if (drag.current !== current || !current.active) return;
      const viewport = window.visualViewport;
      const viewportTop = viewport?.offsetTop ?? 0;
      const viewportBottom = viewportTop + (viewport?.height ?? window.innerHeight);
      const root = document.scrollingElement ?? document.documentElement;
      const rect = current.scrollTarget === root
        ? { top: viewportTop, bottom: viewportBottom }
        : current.scrollTarget.getBoundingClientRect();
      const speed = edgeScrollSpeed(current.y, Math.max(rect.top, viewportTop), Math.min(rect.bottom, viewportBottom));
      if (speed) {
        if (current.scrollTarget === root) window.scrollBy(0, speed);
        else current.scrollTarget.scrollTop += speed;
        if (visual.current?.mode === "touch") updateVisual(visual.current, current.x, current.y, targetAttribute);
        current.frame = requestAnimationFrame(frame);
      } else current.frame = 0;
    };
    const move = (native: TouchEvent) => {
      const finger = Array.from(native.touches).find((item) => item.identifier === current.touchId);
      if (!finger || !current.active) return;
      native.preventDefault();
      current.x = finger.clientX;
      current.y = finger.clientY;
      if (visual.current?.mode === "touch") updateVisual(visual.current, current.x, current.y, targetAttribute);
      if (!current.frame) current.frame = requestAnimationFrame(frame);
    };
    const finish = (native: TouchEvent) => {
      const finger = Array.from(native.changedTouches).find((item) => item.identifier === current.touchId);
      if (!finger) return;
      const date = document.elementFromPoint(finger.clientX, finger.clientY)?.closest<HTMLElement>(`[${targetAttribute}]`)?.getAttribute(targetAttribute);
      current.cancel();
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 500);
      if (date) onCopyRef.current(current.id, date, native.timeStamp, finger.clientY);
    };
    const cancel = () => current.cancel();
    current.cancel = () => {
      window.clearTimeout(current.timer);
      if (current.frame) cancelAnimationFrame(current.frame);
      if (visual.current?.mode === "touch") { removeVisual(visual.current); visual.current = null; }
      current.active = false;
      document.removeEventListener("touchmove", move);
      document.removeEventListener("touchend", finish);
      document.removeEventListener("touchcancel", cancel);
      window.removeEventListener("blur", cancel);
      if (drag.current === current) drag.current = null;
    };
    current.timer = window.setTimeout(() => {
      if (drag.current !== current) return;
      current.active = true;
      visual.current = createPreview(element, targetAttribute === "data-plan-card");
      updateVisual(visual.current, current.x, current.y, targetAttribute);
      document.addEventListener("touchmove", move, { passive: false });
      document.addEventListener("touchend", finish);
      document.addEventListener("touchcancel", cancel);
      window.addEventListener("blur", cancel);
    }, 350);
    drag.current = current;
  }

  function moveBeforeActivation(event: ReactTouchEvent<HTMLElement>) {
    const current = drag.current;
    if (!current || current.active) return;
    const finger = Array.from(event.touches).find((item) => item.identifier === current.touchId);
    if (finger && Math.hypot(finger.clientX - current.startX, finger.clientY - current.startY) > 8) current.cancel();
  }

  function endBeforeActivation() { if (drag.current && !drag.current.active) drag.current.cancel(); }

  return { start, startMouse, stopMouse, moveBeforeActivation, endBeforeActivation, isTouchPending: () => Boolean(drag.current), consumeClick: () => suppressClick.current };
}
