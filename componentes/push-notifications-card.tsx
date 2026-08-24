"use client";

import { useEffect, useMemo, useState } from "react";
import { resolvePushUiState, sameApplicationServerKey, type PushUiState } from "@/lib/push-notification-state";

type PushConfig = {
  configured: boolean;
  publicKey: string;
  activeCurrent?: boolean;
  diagnostics?: {
    publicKeyPresent: boolean;
    publicKeyLength: number;
    publicKeyValid: boolean;
  };
};

const WORKER_URL = "/sw.js";
const WORKER_SCOPE = "/";

function applicationServerKey(value: string) {
  const normalized = value.trim().replace(/^(['"])(.*)\1$/, "$2").trim();
  if (!/^[A-Za-z0-9_-]{80,120}$/.test(normalized)) {
    throw new Error("VAPID_MISSING");
  }
  const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
  const raw = atob(
    (normalized + padding).replace(/-/g, "+").replace(/_/g, "/"),
  );
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  if (bytes.length !== 65 || bytes[0] !== 4) {
    throw new Error("VAPID_INVALID");
  }
  return bytes;
}

function friendlyError(error: unknown) {
  const name = error instanceof Error ? error.name : "UnknownError";
  const technicalMessage = error instanceof Error ? error.message : String(error);
  console.error("[BM Training Push] activación fallida", {
    name,
    message: technicalMessage,
  });
  if (technicalMessage.includes("VAPID_")) {
    return "Las notificaciones todavía no están configuradas.";
  }
  if (Notification.permission === "denied" || name === "NotAllowedError") {
    return "Las notificaciones están bloqueadas en la configuración del teléfono.";
  }
  if (
    /push service|registration failed|network|abort/i.test(technicalMessage) ||
    name === "AbortError" ||
    name === "NetworkError"
  ) {
    return "No se pudo conectar con el servicio de notificaciones. Reintentá en unos minutos.";
  }
  if (
    name === "ServiceWorkerError" ||
    /service worker|worker fetch|worker ready/i.test(technicalMessage)
  ) {
    return "No se pudo preparar el servicio de notificaciones.";
  }
  return "No pudimos activar las notificaciones.";
}

async function validateWorkerResponse() {
  const response = await fetch(WORKER_URL, {
    cache: "no-store",
    redirect: "manual",
  });
  const contentType = response.headers.get("content-type") ?? "";
  const validJavaScript =
    /javascript|ecmascript/i.test(contentType) && !/text\/html/i.test(contentType);
  if (!response.ok || response.redirected || !validJavaScript) {
    throw new DOMException(
      `Worker fetch inválido: HTTP ${response.status}, Content-Type ${contentType || "ausente"}`,
      "ServiceWorkerError",
    );
  }
}

async function readyRegistration(timeoutMs = 12000) {
  let timeout = 0;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => {
        timeout = window.setTimeout(
          () =>
            reject(
              new DOMException("Worker ready timeout", "ServiceWorkerError"),
            ),
          timeoutMs,
        );
      }),
    ]);
  } finally {
    window.clearTimeout(timeout);
  }
}

export function PushNotificationsCard({
  audience = "student",
  compact = false,
}: {
  audience?: "student" | "trainer";
  compact?: boolean;
}) {
  const endpoint = useMemo(
    () => (audience === "trainer" ? "/api/admin/push" : "/api/portal/push"),
    [audience],
  );
  const [state, setState] = useState<PushUiState>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [config, setConfig] = useState<PushConfig | null>(null);

  useEffect(() => {
    void (async () => {
      const supported = window.isSecureContext && (
          "serviceWorker" in navigator &&
          "PushManager" in window &&
          "Notification" in window
        );
      if (!supported) {
        return setState("unsupported");
      }
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
      const standalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        ("standalone" in navigator &&
          Boolean((navigator as Navigator & { standalone?: boolean }).standalone));
      if (isIOS && !standalone) return setState("iphone-browser");
      if (Notification.permission === "denied") return setState("blocked");

      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) throw new Error(`PUSH_CONFIG_HTTP_${response.status}`);
      const loaded = (await response.json()) as PushConfig;
      setConfig(loaded);
      if (
        !loaded.configured ||
        !loaded.publicKey ||
        !loaded.diagnostics?.publicKeyValid
      ) {
        return setState("unconfigured");
      }

      const registration = await navigator.serviceWorker.getRegistration(
        WORKER_SCOPE,
      );
      const subscription = await registration?.pushManager?.getSubscription();
      const validSubscription = subscription
        ? sameApplicationServerKey(
            subscription,
            applicationServerKey(loaded.publicKey),
          )
        : false;
      let backendActive = false;
      if (subscription) {
        const currentResponse = await fetch(
          `${endpoint}?endpoint=${encodeURIComponent(subscription.endpoint)}`,
          { cache: "no-store" },
        );
        if (!currentResponse.ok) throw new Error(`PUSH_STATUS_HTTP_${currentResponse.status}`);
        const currentConfig = (await currentResponse.json()) as PushConfig;
        setConfig(currentConfig);
        backendActive = currentConfig.activeCurrent === true;
      }
      setState(resolvePushUiState({ supported, iphoneBrowser: false, permission: Notification.permission, configured: loaded.configured, hasSubscription: validSubscription, backendActive }));
    })().catch((error) => {
      console.error("[BM Training Push] diagnóstico inicial fallido", error);
      setState("error");
      setMessage("No pudimos comprobar el estado de las notificaciones. Revisá tu conexión e intentá nuevamente.");
    });
  }, [audience, endpoint]);

  async function activate() {
    setBusy(true);
    setMessage("");
    try {
      if (
        !config?.configured ||
        !config.publicKey ||
        !config.diagnostics?.publicKeyValid
      ) {
        throw new Error("VAPID_MISSING");
      }
      if (!window.isSecureContext) {
        throw new DOMException("HTTPS requerido", "SecurityError");
      }
      await validateWorkerResponse();
      await navigator.serviceWorker.register(WORKER_URL, {
        scope: WORKER_SCOPE,
        updateViaCache: "none",
      });
      const registration = await readyRegistration();
      if (!registration.active || !registration.pushManager) {
        throw new DOMException(
          "Service worker o PushManager no disponible",
          "ServiceWorkerError",
        );
      }
      if (Notification.permission === "denied") {
        setState("blocked");
        setMessage("Las notificaciones están bloqueadas en este dispositivo. Activalas desde la configuración del navegador o de BM Training.");
        return;
      }
      const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "inactive");
        setMessage(permission === "denied" ? "Las notificaciones están bloqueadas en este dispositivo. Activalas desde la configuración del navegador o de BM Training." : "No se concedió el permiso. Podés intentarlo nuevamente cuando quieras.");
        return;
      }
      const serverKey = applicationServerKey(config.publicKey);
      let existing = await registration.pushManager.getSubscription();
      if (existing && !sameApplicationServerKey(existing, serverKey)) {
        await existing.unsubscribe();
        existing = null;
      }
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: serverKey,
        }));
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
      const data = (await response.json()) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "SERVER_SUBSCRIPTION_FAILED");
      }
      setState("active");
      setMessage(data.message ?? "Notificaciones activadas correctamente.");
    } catch (error) {
      setState(Notification.permission === "denied" ? "blocked" : "error");
      setMessage(friendlyError(error));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await readyRegistration();
      const subscription = await registration.pushManager?.getSubscription();
      if (subscription) {
        const response = await fetch(endpoint, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        if (!response.ok) throw new Error(`PUSH_DELETE_HTTP_${response.status}`);
        if (audience === "student") {
          await subscription.unsubscribe();
        }
      }
      setState("inactive");
      setMessage("Notificaciones desactivadas en este dispositivo.");
    } catch (error) {
      console.error("[BM Training Push] desactivación fallida", error);
      setMessage("No pudimos desactivar las notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    setBusy(true);
    setMessage("");
    try {
      const registration = await readyRegistration();
      const subscription = await registration.pushManager?.getSubscription();
      if (!subscription) throw new Error("SUBSCRIPTION_NOT_FOUND");
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || "TEST_PUSH_FAILED");
      setMessage("Notificación de prueba enviada.");
    } catch (error) {
      console.error("[BM Training Push] prueba fallida", error);
      setMessage("No pudimos enviar la notificación de prueba.");
    } finally {
      setBusy(false);
    }
  }

  const label = {
    loading: "Comprobando…",
    unsupported: "No compatibles en este dispositivo",
    "iphone-browser": "Requiere instalar la app",
    blocked: "Permiso denegado",
    inactive: "No activadas",
    active: "Activadas",
    unconfigured: "Pendientes de configuración",
    error: "Error temporal",
  }[state];
  const heading =
    audience === "trainer"
      ? "Notificaciones de asistencia"
      : "Notificaciones";
  const description =
    audience === "trainer"
      ? "Recibí un aviso cuando un alumno confirme o rechace su asistencia."
      : "Recibí avisos de pagos, vencimientos, logros y novedades de tu entrenamiento.";
  const contextualMessage = message || (
    state === "iphone-browser"
      ? "Para recibir notificaciones en iPhone, agregá BM Training a la pantalla de inicio desde Compartir → Agregar a pantalla de inicio; luego abrí la app y activalas."
      : state === "blocked"
        ? "Las notificaciones están desactivadas para BM Training. Podés habilitarlas desde la configuración del navegador o del teléfono."
        : state === "unconfigured"
          ? "Las notificaciones todavía no están configuradas."
          : state === "active"
            ? "Notificaciones activadas."
            : state === "error"
              ? "Hubo un error técnico al crear o registrar la suscripción Push. Reintentá en unos minutos."
            : ""
  );

  if (compact) {
    const canToggle = state === "active" || state === "inactive" || state === "error";
    return <div className="rounded-xl border border-white/10 bg-white/[.025] px-4 py-3">
      <div className="flex min-h-8 items-center gap-3"><span className="text-xl text-yellow-400">♢</span><span className="flex-1 text-sm">Notificaciones</span><button type="button" role="switch" aria-label={`Notificaciones: ${label}`} aria-checked={state === "active"} disabled={busy || !canToggle} onClick={state === "active" ? deactivate : activate} className={`relative h-7 w-12 rounded-full border transition ${state === "active" ? "border-yellow-300 bg-yellow-400/25" : "border-zinc-600 bg-zinc-800"} disabled:opacity-50`}><span className={`absolute top-0.5 size-5 rounded-full bg-white transition-transform ${state === "active" ? "translate-x-5" : "translate-x-0.5"}`} /></button></div>
      {(contextualMessage || !canToggle) && <p role="status" className="mt-2 text-[11px] leading-relaxed text-zinc-500">{contextualMessage || label}</p>}
    </div>;
  }

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{heading}</h2>
          <p className="mt-1 max-w-xl text-sm text-zinc-500">{description}</p>
        </div>
        <span className="rounded-full bg-zinc-950 px-2.5 py-1 text-xs text-zinc-400">
          {label}
        </span>
      </div>

      {contextualMessage && (
        <p
          role="status"
          className={`mt-3 text-sm ${
            state === "active" ? "text-emerald-300" : "text-yellow-200"
          }`}
        >
          {contextualMessage}
        </p>
      )}

      {(state === "inactive" || state === "error") && (
        <button
          disabled={busy}
          type="button"
          onClick={activate}
          className="mt-4 rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50"
        >
          {busy ? "Activando…" : "Activar notificaciones"}
        </button>
      )}
      {state === "active" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {audience === "trainer" && (
            <button
              disabled={busy}
              type="button"
              onClick={sendTest}
              className="rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50"
            >
              {busy ? "Enviando…" : "Enviar notificación de prueba"}
            </button>
          )}
          <button
            disabled={busy}
            type="button"
            onClick={deactivate}
            className="rounded-lg border border-zinc-700 px-4 py-2.5 text-sm font-bold text-zinc-300 disabled:opacity-50"
          >
            {busy ? "Desactivando…" : "Desactivar notificaciones"}
          </button>
        </div>
      )}
    </section>
  );
}
