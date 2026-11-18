"use client";

import { useEffect, useRef, type TouchEvent as ReactTouchEvent } from "react";

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

export function useTouchClassCopy(onCopy: (id: string, date: string, at: number) => void) {
  const drag = useRef<ActiveDrag | null>(null);
  const onCopyRef = useRef(onCopy);
  const suppressClick = useRef(false);
  useEffect(() => { onCopyRef.current = onCopy; }, [onCopy]);
  useEffect(() => () => drag.current?.cancel(), []);

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
        current.frame = requestAnimationFrame(frame);
      } else current.frame = 0;
    };
    const move = (native: TouchEvent) => {
      const finger = Array.from(native.touches).find((item) => item.identifier === current.touchId);
      if (!finger || !current.active) return;
      native.preventDefault();
      current.x = finger.clientX;
      current.y = finger.clientY;
      if (!current.frame) current.frame = requestAnimationFrame(frame);
    };
    const finish = (native: TouchEvent) => {
      const finger = Array.from(native.changedTouches).find((item) => item.identifier === current.touchId);
      if (!finger) return;
      const date = document.elementFromPoint(finger.clientX, finger.clientY)?.closest<HTMLElement>("[data-plan-day]")?.dataset.planDay;
      current.cancel();
      suppressClick.current = true;
      window.setTimeout(() => { suppressClick.current = false; }, 500);
      if (date) onCopyRef.current(current.id, date, native.timeStamp);
    };
    const cancel = () => current.cancel();
    current.cancel = () => {
      window.clearTimeout(current.timer);
      if (current.frame) cancelAnimationFrame(current.frame);
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

  return { start, moveBeforeActivation, endBeforeActivation, isTouchPending: () => Boolean(drag.current), consumeClick: () => suppressClick.current };
}
