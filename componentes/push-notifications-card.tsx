"use client";

import { useEffect, useState } from "react";

type PushState = "loading" | "unsupported" | "iphone-browser" | "blocked" | "inactive" | "active" | "unconfigured";
type PushConfig = { configured: boolean; publicKey: string; diagnostics?: { publicKeyPresent: boolean; publicKeyLength: number; publicKeyValid: boolean } };

function applicationServerKey(value: string) {
  const normalized = value.trim().replace(/^(['"])(.*)\1$/, "$2").trim();
  if (!/^[A-Za-z0-9_-]{80,120}$/.test(normalized)) throw new Error("VAPID_MISSING");
  const padding = "=".repeat((4 - normalized.length % 4) % 4);
  const raw = atob((normalized + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) throw new Error("VAPID_INVALID");
  return bytes;
}

function friendlyError(error: unknown) {
  const name = error instanceof Error ? error.name : "UnknownError";
  const technicalMessage = error instanceof Error ? error.message : String(error);
  console.error("[BM Training Push] activación fallida", { name, message: technicalMessage });
  if (technicalMessage.includes("VAPID_")) return "Las notificaciones todavía no están configuradas.";
  if (Notification.permission === "denied" || name === "NotAllowedError") return "Las notificaciones están bloqueadas en la configuración del teléfono.";
  if (name === "ServiceWorkerError" || /service worker|registration/i.test(technicalMessage)) return "No se pudo preparar el servicio de notificaciones.";
  if (/push service|registration failed|network|abort/i.test(technicalMessage) || name === "AbortError" || name === "NetworkError") return "No se pudo conectar con el servicio de notificaciones. Reintentá en unos minutos.";
  return "No pudimos activar las notificaciones.";
}

function logDiagnostics(stage: string, config?: PushConfig, registration?: ServiceWorkerRegistration, previousSubscription?: boolean) {
  console.info("[BM Training Push]", {
    stage,
    secureContext: window.isSecureContext,
    permission: Notification.permission,
    serviceWorkerAvailable: "serviceWorker" in navigator,
    pushManagerAvailable: "PushManager" in window && Boolean(registration?.pushManager),
    worker: registration ? { installing: Boolean(registration.installing), waiting: Boolean(registration.waiting), active: Boolean(registration.active), scope: registration.scope } : null,
    publicKeyPresent: config?.diagnostics?.publicKeyPresent ?? Boolean(config?.publicKey),
    publicKeyLength: config?.diagnostics?.publicKeyLength ?? config?.publicKey.length ?? 0,
    publicKeyValid: config?.diagnostics?.publicKeyValid ?? false,
    previousSubscription: previousSubscription ?? null,
  });
}

export function PushNotificationsCard() {
  const [state, setState] = useState<PushState>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [config, setConfig] = useState<PushConfig | null>(null);
  useEffect(() => {
    void (async () => {
      if (!window.isSecureContext || !("serviceWorker" in navigator && "PushManager" in window && "Notification" in window)) return setState("unsupported");
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const standalone = window.matchMedia("(display-mode: standalone)").matches || ("standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      if (isIOS && !standalone) return setState("iphone-browser");
      if (Notification.permission === "denied") return setState("blocked");
      const response = await fetch("/api/portal/push", { cache: "no-store" });
      if (!response.ok) return setState("unsupported");
      const loaded = await response.json() as PushConfig;
      setConfig(loaded);
      if (!loaded.configured || !loaded.publicKey || !loaded.diagnostics?.publicKeyValid) return setState("unconfigured");
      const registrations = await navigator.serviceWorker.getRegistrations();
      const matching = registrations.find((item) => new URL(item.scope).pathname === "/");
      const subscription = await matching?.pushManager?.getSubscription();
      logDiagnostics("estado inicial", loaded, matching, Boolean(subscription));
      setState(subscription ? "active" : "inactive");
    })().catch((error) => { console.error("[BM Training Push] diagnóstico inicial fallido", { name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error) }); setState("unsupported"); });
  }, []);
  async function activate() {
    setBusy(true); setMessage("");
    try {
      if (!config?.configured || !config.publicKey || !config.diagnostics?.publicKeyValid) throw new Error("VAPID_MISSING");
      if (!window.isSecureContext) throw new DOMException("HTTPS requerido", "SecurityError");
      await navigator.serviceWorker.register("/sw.js?v=2", { scope: "/", updateViaCache: "none" });
      const registration = await navigator.serviceWorker.ready;
      if (!registration.active || !registration.pushManager) throw new DOMException("Service worker o PushManager no disponible", "ServiceWorkerError");
      await registration.update().catch(() => undefined);
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") { setState("blocked"); setMessage("Las notificaciones están bloqueadas en la configuración del teléfono."); return; }
      const existing = await registration.pushManager.getSubscription();
      logDiagnostics("antes de suscribir", config, registration, Boolean(existing));
      const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationServerKey(config.publicKey) });
      const response = await fetch("/api/portal/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(subscription.toJSON()) });
      const data = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(data.error || "SERVER_SUBSCRIPTION_FAILED");
      setState("active"); setMessage(data.message ?? "Notificaciones activadas correctamente.");
    } catch (error) { setMessage(friendlyError(error)); }
    finally { setBusy(false); }
  }
  async function deactivate() {
    setBusy(true); setMessage("");
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager?.getSubscription();
      if (subscription) {
        await fetch("/api/portal/push", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: subscription.endpoint }) });
        await subscription.unsubscribe();
      }
      setState("inactive"); setMessage("Notificaciones desactivadas en este dispositivo.");
    } catch (error) { console.error("[BM Training Push] desactivación fallida", { name: error instanceof Error ? error.name : "UnknownError", message: error instanceof Error ? error.message : String(error) }); setMessage("No pudimos desactivar las notificaciones."); }
    finally { setBusy(false); }
  }
  const label = { loading: "Comprobando…", unsupported: "No compatibles en este dispositivo", "iphone-browser": "Requiere instalar la app", blocked: "Bloqueadas por el navegador", inactive: "No activadas", active: "Activadas", unconfigured: "Pendientes de configuración" }[state];
  return <section className="mt-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold">Notificaciones de logros</h2><p className="mt-1 max-w-xl text-sm text-zinc-500">Recibí un aviso cuando desbloquees un logro o superes una marca personal.</p></div><span className="rounded-full bg-zinc-950 px-2.5 py-1 text-xs text-zinc-400">{label}</span></div>{state === "iphone-browser" && <p className="mt-3 text-sm text-yellow-200">Para recibir notificaciones en iPhone, agregá BM Training a la pantalla de inicio: Compartir → Agregar a pantalla de inicio → abrí la app → activá las notificaciones.</p>}{state === "blocked" && <p className="mt-3 text-sm text-yellow-200">Las notificaciones están bloqueadas. Podés habilitarlas desde la configuración del navegador o del teléfono.</p>}{state === "unconfigured" && <p className="mt-3 text-sm text-zinc-500">Las notificaciones todavía no están configuradas.</p>}{message && <p role="status" className={`mt-3 text-sm ${state === "active" ? "text-emerald-300" : "text-yellow-200"}`}>{message}</p>}{state === "inactive" && <button disabled={busy} type="button" onClick={activate} className="mt-4 rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50">{busy ? "Activando…" : "Activar notificaciones"}</button>}{state === "active" && <button disabled={busy} type="button" onClick={deactivate} className="mt-4 rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-bold text-zinc-300 disabled:opacity-50">{busy ? "Desactivando…" : "Desactivar notificaciones"}</button>}</section>;
}
