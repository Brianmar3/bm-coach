// Store only navigation position, never portal data. Keys are isolated by student.
export function trackPortalHomeScroll(win: Window, key: string, home: boolean) {
  let leaving = false;
  let restoring = false;
  let frame = 0;
  let timer = 0;
  let observer: ResizeObserver | undefined;
  const save = () => {
    if (!home || leaving || restoring) return;
    try { win.sessionStorage.setItem(key, String(win.scrollY)); } catch { /* Storage may be unavailable. */ }
  };
  const stop = () => { restoring = false; win.cancelAnimationFrame(frame); win.clearTimeout(timer); observer?.disconnect(); };
  const cancel = () => { stop(); save(); };
  const leave = (event: Event) => {
    if (event instanceof MouseEvent && (event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
    const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    if (event.type === "click" && (!link || link.target === "_blank" || link.hasAttribute("download") || new URL(link.href).origin !== win.location.origin || new URL(link.href).pathname === win.location.pathname)) return;
    save(); leaving = true;
  };
  if (home) {
    let y = 0;
    try { y = Number(win.sessionStorage.getItem(key)); } catch { /* Native history remains available. */ }
    if (Number.isFinite(y) && y > 0 && !win.location.hash) {
      restoring = true;
      const restore = () => {
        win.scrollTo({ top: y, behavior: "instant" });
        if (win.document.documentElement.scrollHeight - win.innerHeight >= y) stop();
      };
      // Wait for the router's scroll handling and for streamed content to obtain its height.
      frame = win.requestAnimationFrame(() => { frame = win.requestAnimationFrame(restore); });
      if (typeof ResizeObserver !== "undefined") { observer = new ResizeObserver(restore); observer.observe(win.document.documentElement); }
      timer = win.setTimeout(stop, 1200);
    }
    win.addEventListener("scroll", save, { passive: true });
    win.addEventListener("pagehide", save);
    win.addEventListener("popstate", leave);
    win.document.addEventListener("click", leave, true);
    for (const name of ["wheel", "touchstart", "keydown"]) win.addEventListener(name, cancel, { passive: true });
  }
  return () => {
    stop();
    win.removeEventListener("scroll", save); win.removeEventListener("pagehide", save);
    win.removeEventListener("popstate", leave); win.document.removeEventListener("click", leave, true);
    for (const name of ["wheel", "touchstart", "keydown"]) win.removeEventListener(name, cancel);
  };
}
