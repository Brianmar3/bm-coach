"use client";

import { useEffect, useState } from "react";

type PushState = "loading" | "unsupported" | "iphone-browser" | "blocked" | "inactive" | "active" | "unconfigured";
function applicationServerKey(value: string) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const raw = atob((value + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (character) => character.charCodeAt(0));
}

export function PushNotificationsCard() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [publicKey, setPublicKey] = useState("");
  useEffect(() => {
    void (async () => {
      if (!("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) return setState("unsupported");
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      if (isIOS && !standalone) return setState("iphone-browser");
      if (Notification.permission === "denied") return setState("blocked");
      const response = await fetch("/api/portal/push", { cache: "no-store" });
      if (!response.ok) return setState("unsupported");
      const data = await response.json() as { configured: boolean; publicKey: string };
      if (!data.configured || !data.publicKey) return setState("unconfigured");
      setPublicKey(data.publicKey);
      const registration = await navigator.serviceWorker.getRegistration("/");
      setState(await registration?.pushManager.getSubscription() ? "active" : "inactive");
    })();
  }, []);
  async function activate() {
    setBusy(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      if (await Notification.requestPermission() !== "granted") return setState("blocked");
      const subscription = await registration.pushManager.getSubscription() ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(publicKey) });
      const response = await fetch("/api/portal/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "No se pudieron activar.");
      setState("active"); setMessage(data.message ?? "Notificaciones activadas correctamente.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron activar las notificaciones."); }
    finally { setBusy(false); }
  }
  async function deactivate() {
    setBusy(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/");
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch("/api/portal/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setState("inactive"); setMessage("Notificaciones desactivadas en este dispositivo.");
    } finally { setBusy(false); }
  }
  const label = { loading: "Comprobando…", unsupported: "No compatibles en este dispositivo", "iphone-browser": "Requiere instalar la app", blocked: "Bloqueadas por el navegador", inactive: "No activadas", active: "Activadas", unconfigured: "Pendientes de configuración" }[state];
  return <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Notificaciones de logros</h2><p className="mt-1 max-w-xl text-sm text-zinc-500">Recibí un aviso cuando desbloquees un logro o superes una marca personal.</p></div><span className="rounded-full bg-zinc-950 px-2.5 py-1 text-xs text-zinc-400">{label}</span></div>{state === "iphone-browser" && <p className="mt-3 text-sm text-yellow-200">Para recibir notificaciones en iPhone, agregá BM Training a la pantalla de inicio: Compartir → Agregar a pantalla de inicio → abrí la app → activá las notificaciones.</p>}{state === "blocked" && <p className="mt-3 text-sm text-yellow-200">Las notificaciones están bloqueadas. Podés habilitarlas desde la configuración del navegador o del teléfono.</p>}{state === "unconfigured" && <p className="mt-3 text-sm text-zinc-500">El entrenador todavía debe completar la configuración segura del servicio.</p>}{message && <p role="status" className="mt-3 text-sm text-emerald-300">{message}</p>}{state === "inactive" && <button disabled={busy} type="button" onClick={activate} className="mt-4 rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50">{busy ? "Activando…" : "Activar notificaciones"}</button>}{state === "active" && <button disabled={busy} type="button" onClick={deactivate} className="mt-4 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-bold text-zinc-300 disabled:opacity-50">{busy ? "Desactivando…" : "Desactivar notificaciones"}</button>}</section>;
}
