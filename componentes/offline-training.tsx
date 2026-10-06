"use client";
import { useEffect, useState, type CSSProperties } from "react";
import { hydrateOfflineTraining, offlineTrainingState, offlineWorkoutData, refreshOfflineTraining, subscribeOfflineTraining, logoutOfflineTraining, forgetOfflineTrainingMemory } from "@/lib/offline-training-client";
import { workspaceBrandingVariables } from "@/lib/workspace-branding";
import { WorkoutView } from "@/componentes/portal-section";
import { RestTimerProvider } from "@/componentes/rest-timer-provider";
import { WorkspaceBrandingValueProvider } from "@/componentes/workspace-branding-provider";

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
  if (!state?.snapshot) return null;
  return <aside role="status" className="mx-auto my-3 max-w-5xl rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm text-[var(--foreground)]">
    <p className="font-bold">{!online ? "Modo sin conexión" : state.pending ? "Pendiente de sincronización" : "Sincronizado"}</p>
    {!online && <p className="mt-1 text-[var(--foreground-muted)]">Estás viendo la última rutina guardada en este dispositivo. Los cambios se sincronizarán cuando vuelva internet.</p>}
    {state.pending > 0 && <p className="mt-1">{state.pending} entrenamiento(s) pendiente(s) de sincronización.</p>}
    {state.error && <p className="mt-1 text-[var(--foreground-muted)]">{state.error}</p>}
    <a href="/portal/offline" className="mt-2 inline-block min-h-11 py-2 font-semibold text-[var(--brand-text)]">Abrir rutina guardada</a>
    {online && state.pending > 0 && <button type="button" onClick={() => void refreshOfflineTraining()} className="ml-4 min-h-11 font-semibold">Reintentar sincronización</button>}
  </aside>;
}

export function OfflineTrainingPage() {
  const [data, setData] = useState<ReturnType<typeof offlineWorkoutData>>(null);
  const [snapshot, setSnapshot] = useState<ReturnType<typeof offlineTrainingState>["snapshot"]>();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const update = () => { setData(offlineWorkoutData()); setSnapshot(offlineTrainingState().snapshot); setLoaded(true); };
    const unsubscribe = subscribeOfflineTraining(update);
    void hydrateOfflineTraining().then(() => { update(); void refreshOfflineTraining(); }).catch(() => setLoaded(true));
    const reconnect = () => { void refreshOfflineTraining(); };
    window.addEventListener("online", reconnect);
    return () => { unsubscribe(); window.removeEventListener("online", reconnect); };
  }, []);
  if (!loaded) return <p className="p-6">Abriendo tu rutina guardada…</p>;
  if (!snapshot || !data) return <main className="mx-auto max-w-xl p-6"><h1 className="text-2xl font-bold">Rutina sin conexión</h1><p className="mt-3">{snapshot ? "Conectate para renovar el acceso a la rutina guardada. Tus registros pendientes siguen en este dispositivo." : "Todavía no hay una rutina disponible sin conexión en este dispositivo. Abrí la app con internet para guardarla."}</p><a href="/portal/login" className="mt-4 inline-block min-h-11 py-2">Conectar e ingresar</a></main>;
  return <WorkspaceBrandingValueProvider branding={snapshot.branding}><RestTimerProvider><main className="workspace-brand min-h-screen bg-[var(--background)] p-4 text-[var(--foreground)]" style={workspaceBrandingVariables(snapshot.branding.accentColor) as CSSProperties}>
    <header className="mx-auto flex max-w-5xl items-center justify-between"><p className="font-bold">{snapshot.branding.displayName} · Mi rutina</p><button type="button" onClick={() => { void logoutOfflineTraining().then((closed) => { if (closed) window.location.assign("/portal/login"); }); }} className="min-h-11 px-3 text-sm">Cerrar sesión</button></header>
    <OfflineTrainingBridge /><WorkoutView data={data} />
  </main></RestTimerProvider></WorkspaceBrandingValueProvider>;
}
