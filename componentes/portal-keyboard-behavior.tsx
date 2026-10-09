"use client";

import { useEffect } from "react";
import { isKeyboardEditable, portalKeyboardIsOpen } from "@/lib/portal-keyboard";

/** Shared portal headers cover online, offline and self-service student shells. */
export function PortalKeyboardBehavior() {
  useEffect(() => {
    const root = document.documentElement;
    const viewport = window.visualViewport;
    const media = window.matchMedia("(max-width: 767px) and (any-pointer: coarse)");
    let baseline = Math.max(window.innerHeight, root.clientHeight);
    let width = window.innerWidth;
    let open = false;
    let orientationChanged = false;
    let frame = 0;
    const update = () => {
      frame = 0;
      if (orientationChanged || Math.abs(window.innerWidth - width) > 32) {
        orientationChanged = false;
        width = window.innerWidth;
        baseline = Math.max(window.innerHeight, root.clientHeight, window.screen.availHeight);
      }
      const height = viewport?.height ?? window.innerHeight;
      const editable = isKeyboardEditable(document.activeElement);
      if (!editable && !open) baseline = Math.max(window.innerHeight, root.clientHeight);
      else baseline = Math.max(baseline, window.innerHeight, root.clientHeight);
      const next = portalKeyboardIsOpen({ mobile: media.matches, editable, wasOpen: open, baselineHeight: baseline, viewportHeight: height, layoutHeight: window.innerHeight, scale: viewport?.scale ?? 1 });
      if (next !== open) {
        open = next;
        if (open) root.setAttribute("data-portal-keyboard", "open");
        else root.removeAttribute("data-portal-keyboard");
      }
    };
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };
    const orient = () => { orientationChanged = true; schedule(); };
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", orient);
    document.addEventListener("focusin", schedule);
    document.addEventListener("focusout", schedule);
    viewport?.addEventListener("resize", schedule);
    viewport?.addEventListener("scroll", schedule);
    media.addEventListener("change", schedule);
    schedule();
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", orient);
      document.removeEventListener("focusin", schedule);
      document.removeEventListener("focusout", schedule);
      viewport?.removeEventListener("resize", schedule);
      viewport?.removeEventListener("scroll", schedule);
      media.removeEventListener("change", schedule);
      root.removeAttribute("data-portal-keyboard");
    };
  }, []);
  return null;
}
