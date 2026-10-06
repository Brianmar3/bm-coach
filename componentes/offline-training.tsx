"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { hydrateOfflineTraining, offlineTrainingState, offlineWorkoutData, refreshOfflineTraining, subscribeOfflineTraining, logoutOfflineTraining, forgetOfflineTrainingMemory } from "@/lib/offline-training-client";
import { workspaceBrandingVariables } from "@/lib/workspace-branding";
import { WorkoutView } from "@/componentes/portal-section";
import { RestTimerProvider } from "@/componentes/rest-timer-provider";
import { WorkspaceBrandingValueProvider } from "@/componentes/workspace-branding-provider";
import { PortalHeader, PortalNavigationLink, PORTAL_MOBILE_NAV_CLASS } from "@/componentes/portal-visuals";
import { BmHomeIcon, BmRoutineIcon } from "@/componentes/icons";
import { OfflineRoutineHome } from "@/componentes/portal-section";

export function OfflineTrainingBridge() {
  const [state, setState] = useState<ReturnType<typeof offlineTrainingState> | null>(null);
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => { setState(offlineTrainingState()); setOnline(navigator.onLine); };
    const unsubscribe = subscribeOfflineTraining(update);
    const refresh = () => { update(); void refreshOfflineTraining(); };
    void refreshOfflineTraining(); update();
    window.addEventListener("online", refresh); window.addEventListener("offline", update);
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", visible);
    const interval = window.setInterval(() => { if (navigator.onLine && document.visibilityState === "visible") void refreshOfflineTraining(); }, 30000);
    const channel = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("bm-offline-training") : null;
    if (channel) channel.onmessage = (event) => { if (event.data === "logout") forgetOfflineTrainingMemory(); void hydrateOfflineTraining().then(update); };
    return () => { unsubscribe(); window.removeEventListener("online", refresh); window.removeEventListener("offline", update); document.removeEventListener("visibilitychange", visible); window.clearInterval(interval); channel?.close(); };
  }, []);
  if (!state?.snapshot || (online && !state.pending)) return null;
  return <aside role="status" className="mx-auto mb-2 flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-1 px-1 text-xs text-[var(--foreground-muted)]">
    <span>{!online ? "Modo sin conexión" : "Pendiente de sincronización"}</span>
    {!online && state.error.includes("guardar") && <span>{state.error}</span>}
    {online && state.pending > 0 && state.error && <><span>{state.error}</span><button type="button" onClick={() => void refreshOfflineTraining()} className="min-h-11 font-semibold text-[var(--brand-text)]">Reintentar sincronización</button></>}
  </aside>;
}

export function OfflineTrainingPage() {
  const [data, setData] = useState<ReturnType<typeof offlineWorkoutData>>(null);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof offlineTrainingState>["snapshot"]>();
  const [loaded, setLoaded] = useState(false);
  const [home, setHome] = useState(false);
  const restorePortal = useRef(false);
  useEffect(() => {
    const update = () => {
      const state = offlineTrainingState();
      setData(offlineWorkoutData()); setSnapshot(state.snapshot); setHome(window.location.pathname === "/portal"); setLoaded(true);
      if (restorePortal.current && navigator.onLine && !state.pending && !state.error && ["/portal", "/portal/rutina"].includes(window.location.pathname)) {
        restorePortal.current = false;
        window.location.assign(window.location.href);
      }
    };
    const unsubscribe = subscribeOfflineTraining(update);
    void hydrateOfflineTraining().then(() => { update(); void refreshOfflineTraining(); }).catch(() => setLoaded(true));
    const reconnect = () => { void refreshOfflineTraining().then(() => { restorePortal.current = true; update(); }); };
    window.addEventListener("online", reconnect);
    return () => { unsubscribe(); window.removeEventListener("online", reconnect); };
  }, []);
  if (!loaded) return <p className="p-6">Abriendo tu rutina guardada…</p>;
  if (!snapshot || !data) return <main className="mx-auto max-w-xl p-6"><h1 className="text-2xl font-bold">Rutina sin conexión</h1><p className="mt-3">{snapshot ? "Conectate para renovar el acceso a la rutina guardada. Tus registros pendientes siguen en este dispositivo." : "Todavía no hay una rutina disponible sin conexión en este dispositivo. Abrí la app con internet para guardarla."}</p><a href="/portal/login" className="mt-4 inline-block min-h-11 py-2">Conectar e ingresar</a></main>;
  return <WorkspaceBrandingValueProvider branding={snapshot.branding}><RestTimerProvider><div className="workspace-brand min-h-screen bg-[var(--background)] text-[var(--foreground)]" style={workspaceBrandingVariables(snapshot.branding.accentColor) as CSSProperties} onClickCapture={(event) => {
    // The public fallback has no authenticated RSC payload. Use ordinary document
    // navigation so the existing service worker can open either habitual route.
    const link = (event.target as Element).closest("a");
    if (!link || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin === window.location.origin && ["/portal", "/portal/rutina"].includes(url.pathname)) { event.preventDefault(); event.stopPropagation(); window.location.assign(url.href); }
  }}>
    <PortalHeader branding={snapshot.branding} studentName="" actions={<button type="button" onClick={() => { void logoutOfflineTraining().then((closed) => { if (closed) window.location.assign("/portal/login"); }); }} className="min-h-11 px-3 text-xs">Cerrar sesión</button>}>
      <nav aria-label="Navegación del portal" className="mx-auto hidden max-w-6xl gap-5 px-5 pb-2 md:flex"><a href="/portal" className="py-2">Inicio</a><a href="/portal/rutina" className="py-2">Rutina</a></nav>
    </PortalHeader>
    <main className="mx-auto max-w-6xl p-2.5 pb-[calc(var(--portal-bottom-nav-height)+var(--portal-bottom-nav-offset)+var(--portal-bottom-nav-clearance)+env(safe-area-inset-bottom))] sm:p-6 md:pb-12"><OfflineTrainingBridge />{home ? <OfflineRoutineHome data={data} /> : <WorkoutView data={data} />}</main>
    <nav aria-label="Navegación móvil del portal" className={PORTAL_MOBILE_NAV_CLASS} style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))" }}><PortalNavigationLink title="Inicio" href="/portal" Icon={BmHomeIcon} active={home} /><PortalNavigationLink title="Rutina" href="/portal/rutina" Icon={BmRoutineIcon} active={!home} /></nav>
  </div></RestTimerProvider></WorkspaceBrandingValueProvider>;
}
