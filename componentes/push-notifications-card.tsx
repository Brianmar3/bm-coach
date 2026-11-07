"use client";

import { useEffect, useMemo, useState } from "react";
import { resolvePushUiState, sameApplicationServerKey, type PushUiState } from "@/lib/push-notification-state";
import { SettingsIcon } from "@/componentes/settings-icons";
import { activateStudentWebPush, safePushErrorName, StudentWebPushError } from "@/lib/student-web-push";
import {
  checkNativePushPermissions,
  createNativePushChannel,
  getNativePushEnvironment,
  listenForNativePushActions,
  openNativeNotificationSettings,
  permissionIsBlocked,
  registerNativePushToken,
  requestNativePushPermissions,
  unregisterNativePush,
  type NativePushEnvironment,
} from "@/lib/native-push-client";

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

type NativePushConfig = {
  configured: boolean;
  activeCurrent?: boolean;
  activeDevices?: number;
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
  if (
    (typeof Notification !== "undefined" && Notification.permission === "denied") ||
    name === "NotAllowedError"
  ) {
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

type NativePushActivationStage =
  | "permission-check"
  | "permission-request"
  | "channel"
  | "firebase-token"
  | "backend-register";

function nativeFriendlyError(error: unknown, stage: NativePushActivationStage) {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[BM Training Native Push] activación fallida", {
    stage,
    name: error instanceof Error ? error.name : "UnknownError",
    message,
  });
  if (stage === "firebase-token") {
    return "No se pudo registrar este dispositivo con Firebase. Revisá la conexión e intentá nuevamente.";
  }
  if (stage === "backend-register") {
    return "Firebase generó el token, pero no pudimos registrar este dispositivo en BM Training. Reintentá en unos minutos.";
  }
  if (stage === "permission-check" || stage === "permission-request") {
    return "No pudimos comprobar el permiso de notificaciones de Android.";
  }
  if (stage === "channel") {
    return "No pudimos preparar el canal de notificaciones de Android.";
  }
  return "No pudimos activar las notificaciones Android.";
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
  const nativeEndpoint = useMemo(
    () =>
      audience === "trainer"
        ? "/api/admin/native-push"
        : "/api/portal/native-push",
    [audience],
  );
  const [state, setState] = useState<PushUiState>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [webDiagnostics, setWebDiagnostics] = useState<string[]>([]);
  const [config, setConfig] = useState<PushConfig | null>(null);
  const [nativeEnvironment, setNativeEnvironment] =
    useState<NativePushEnvironment | null>(null);
  const [nativeConfigured, setNativeConfigured] = useState(false);
  const [nativeToken, setNativeToken] = useState("");

  useEffect(() => {
    let cancelled = false;
    let actionListener: Awaited<
      ReturnType<typeof listenForNativePushActions>
    > | null = null;

    void (async () => {
      const detectedNativeEnvironment = await getNativePushEnvironment();
      if (detectedNativeEnvironment) {
        if (cancelled) return;
        setNativeEnvironment(detectedNativeEnvironment);
        actionListener = await listenForNativePushActions();

        const configResponse = await fetch(
          `${nativeEndpoint}?appId=${encodeURIComponent(detectedNativeEnvironment.appId)}`,
          { cache: "no-store" },
        );
        if (!configResponse.ok) {
          throw new Error(`NATIVE_PUSH_CONFIG_HTTP_${configResponse.status}`);
        }
        const loaded = (await configResponse.json()) as NativePushConfig;
        if (cancelled) return;
        setNativeConfigured(loaded.configured);
        if (!loaded.configured) {
          setState("unconfigured");
          return;
        }

        const permission = await checkNativePushPermissions();
        if (cancelled) return;
        if (permissionIsBlocked(permission)) {
          setState("blocked");
          return;
        }
        if (permission.receive !== "granted") {
          setState("inactive");
          return;
        }

        await createNativePushChannel();
        const token = await registerNativePushToken();
        if (cancelled) return;
        setNativeToken(token);
        const statusResponse = await fetch(
          `${nativeEndpoint}?appId=${encodeURIComponent(detectedNativeEnvironment.appId)}&token=${encodeURIComponent(token)}`,
          { cache: "no-store" },
        );
        if (!statusResponse.ok) {
          throw new Error(`NATIVE_PUSH_STATUS_HTTP_${statusResponse.status}`);
        }
        const status = (await statusResponse.json()) as NativePushConfig;
        if (!cancelled) setState(status.activeCurrent ? "active" : "inactive");
        return;
      }

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
      const validSubscription = subscription && (audience !== "student" || subscription.expirationTime == null || subscription.expirationTime > Date.now())
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
      if (cancelled) return;
      console.error("[BM Training Push] diagnóstico inicial fallido", error);
      setState("error");
      setMessage("No pudimos comprobar el estado de las notificaciones. Revisá tu conexión e intentá nuevamente.");
    });
    return () => {
      cancelled = true;
      if (actionListener) void actionListener.remove();
    };
  }, [audience, endpoint, nativeEndpoint]);

  async function activate() {
    setBusy(true);
    setMessage("");
    let nativeStage: NativePushActivationStage = "permission-check";
    const diagnoseWeb = audience === "student" && !nativeEnvironment;
    let webStage = "validar VAPID";
    const report = (line: string) => setWebDiagnostics((current) => [...current, line]);
    if (diagnoseWeb) {
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      setWebDiagnostics([`Modo standalone: ${standalone ? "sí" : "no"}`, `Contexto seguro: ${window.isSecureContext ? "sí" : "no"}`]);
    }
    try {
      if (nativeEnvironment) {
        if (!nativeConfigured) {
          setState("unconfigured");
          setMessage("Firebase todavía no está configurado para esta APK.");
          return;
        }
        let permission = await checkNativePushPermissions();
        if (permissionIsBlocked(permission)) {
          setState("blocked");
          setMessage("Las notificaciones están bloqueadas en Android. Podés habilitarlas desde la configuración de BM Training.");
          return;
        }
        if (permission.receive !== "granted") {
          nativeStage = "permission-request";
          permission = await requestNativePushPermissions();
        }
        if (permission.receive !== "granted") {
          const blocked = permissionIsBlocked(permission);
          setState(blocked ? "blocked" : "inactive");
          setMessage(
            blocked
              ? "Las notificaciones están bloqueadas en Android. Habilitalas desde Ajustes > Apps > BM Training > Notificaciones."
              : "No se concedió el permiso. Podés intentarlo nuevamente cuando quieras.",
          );
          return;
        }
        nativeStage = "channel";
        await createNativePushChannel();
        nativeStage = "firebase-token";
        const token = await registerNativePushToken();
        nativeStage = "backend-register";
        const response = await fetch(nativeEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appId: nativeEnvironment.appId,
            token,
            platform: nativeEnvironment.platform,
            deviceLabel: nativeEnvironment.appName,
          }),
        });
        const data = (await response.json()) as { message?: string; error?: string };
        if (!response.ok) throw new Error(data.error || "NATIVE_PUSH_REGISTER_FAILED");
        setNativeToken(token);
        setState("active");
        setMessage(data.message ?? "Notificaciones Android activadas correctamente.");
        return;
      }

      if (
        !config?.configured ||
        !config.publicKey ||
        !config.diagnostics?.publicKeyValid
      ) {
        throw new Error("VAPID_MISSING");
      }
      if (!window.isSecureContext) {
        webStage = "comprobar contexto seguro";
        throw new DOMException("HTTPS requerido", "SecurityError");
      }
      if (audience === "student") {
        const key = applicationServerKey(config.publicKey);
        report("VAPID: par validado por el servidor y formato aceptado por el cliente");
        webStage = "comprobar permiso";
        const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
        report(`Permiso: ${permission}`);
        if (permission !== "granted") {
          setState(permission === "denied" ? "blocked" : "inactive");
          setMessage(permission === "denied" ? "Chrome tiene bloqueadas las notificaciones de este sitio." : "No se concedió el permiso de notificaciones.");
          return;
        }
        webStage = "buscar Service Worker";
        const current = await navigator.serviceWorker.getRegistration(WORKER_SCOPE);
        if (!current?.active) {
          webStage = "registrar Service Worker";
          await navigator.serviceWorker.register(WORKER_URL, { scope: WORKER_SCOPE, updateViaCache: "none" });
        }
        webStage = "esperar Service Worker activo";
        const registration = current?.active ? current : await readyRegistration();
        const expectedScope = new URL(WORKER_SCOPE, window.location.origin).href;
        const expectedScript = new URL(WORKER_URL, window.location.origin).href;
        report(`Worker activo: ${registration.active?.state ?? "ausente"}`);
        report(`Scope esperado: ${registration.scope === expectedScope ? "sí" : "no"}`);
        report(`Script activo esperado: ${registration.active?.scriptURL === expectedScript ? "sí" : "no"}`);
        const controller = navigator.serviceWorker.controller;
        report(`Control de esta página: ${!controller ? "ausente" : controller.scriptURL === expectedScript ? "worker esperado" : "otro worker"}`);
        webStage = "comprobar PushManager";
        if (!registration.pushManager) throw new DOMException("PushManager no disponible", "ServiceWorkerError");
        await activateStudentWebPush(registration.pushManager, key, (subscription) => fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(subscription.toJSON()),
        }), (previous) => report(`Suscripción anterior: ${previous}`));
        report("Resultado: suscripción registrada");
        setState("active");
        setMessage("Notificaciones activadas correctamente.");
        return;
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
      if (nativeEnvironment) {
        setState("error");
        setMessage(nativeFriendlyError(error, nativeStage));
      } else {
        setState(Notification.permission === "denied" ? "blocked" : "error");
        if (diagnoseWeb) {
          const stage = error instanceof StudentWebPushError ? error.stage : webStage;
          const name = error instanceof StudentWebPushError ? error.errorName : safePushErrorName(error);
          const status = error instanceof StudentWebPushError ? error.status : undefined;
          report(`Fallo: ${stage} · ${status ? `HTTP ${status}` : name}`);
        }
        if (error instanceof StudentWebPushError) {
          console.warn("[BM Training Web Push] activación fallida", { stage: error.stage, status: error.status });
          setMessage(error.stage !== "server" ? `Chrome no pudo completar ${error.stage}. Consultá el diagnóstico.` :
            error.status === 401 ? "Tu sesión venció. Volvé a ingresar e intentá nuevamente." :
            error.status === 409 ? "Esta suscripción pertenece a otra cuenta. Desactivala desde esa cuenta antes de continuar." :
            error.status === 503 ? "Las notificaciones Web Push todavía no están configuradas." :
            "Chrome tiene una suscripción, pero BM Training no pudo registrarla. Reintentá en unos minutos.");
        } else if (diagnoseWeb) setMessage("No se pudo activar Web Push. Consultá el diagnóstico.");
        else setMessage(friendlyError(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function openNotificationSettings() {
    setBusy(true);
    setMessage("");
    try {
      await openNativeNotificationSettings();
      setMessage("Activá las notificaciones de BM Training y luego volvé a la app.");
    } catch {
      setMessage("No pudimos abrir la configuración de notificaciones.");
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    setBusy(true);
    setMessage("");
    try {
      if (nativeEnvironment) {
        const token = nativeToken || await registerNativePushToken();
        const response = await fetch(nativeEndpoint, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appId: nativeEnvironment.appId,
            token,
            platform: nativeEnvironment.platform,
            deviceLabel: nativeEnvironment.appName,
          }),
        });
        if (!response.ok) throw new Error(`NATIVE_PUSH_DELETE_HTTP_${response.status}`);
        await unregisterNativePush();
        setNativeToken("");
        setState("inactive");
        setMessage("Notificaciones desactivadas en este dispositivo.");
        return;
      }

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
      if (nativeEnvironment) {
        const token = nativeToken || await registerNativePushToken();
        const response = await fetch(nativeEndpoint, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            appId: nativeEnvironment.appId,
            token,
            platform: nativeEnvironment.platform,
            deviceLabel: nativeEnvironment.appName,
          }),
        });
        const data = (await response.json()) as { error?: string };
        if (!response.ok) throw new Error(data.error || "NATIVE_TEST_PUSH_FAILED");
        setMessage("Notificación de prueba enviada.");
        return;
      }

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
        ? nativeEnvironment
          ? "Las notificaciones están bloqueadas en Android. Habilitalas desde Ajustes > Apps > BM Training > Notificaciones."
          : "Las notificaciones están desactivadas para BM Training. Podés habilitarlas desde la configuración del navegador o del teléfono."
        : state === "unconfigured"
          ? nativeEnvironment
            ? "Firebase todavía no está configurado para esta APK."
            : "Las notificaciones todavía no están configuradas."
          : state === "active"
            ? "Notificaciones activadas."
            : state === "error"
              ? "Hubo un error técnico al crear o registrar la suscripción Push. Reintentá en unos minutos."
            : ""
  );

  const diagnostics = audience === "student" && !nativeEnvironment && (webDiagnostics.length > 0 || config) && (
    <details className="mt-2 text-xs text-zinc-400">
      <summary>Diagnóstico Web Push</summary>
      <ul className="mt-1 space-y-1">
        {config && <li>VAPID en servidor: {config.configured ? "válida" : "no disponible o inválida"}</li>}
        {webDiagnostics.map((line) => <li key={line}>{line}</li>)}
      </ul>
    </details>
  );

  if (compact) {
    const canToggle = state === "active" || state === "inactive" || state === "error";
    return <div className="rounded-xl border border-white/10 bg-white/[.025] px-4 py-3">
      <div className="flex min-h-8 items-center gap-3"><SettingsIcon name="bell" className="size-6 shrink-0 text-yellow-400" /><span className="min-w-0 flex-1 text-sm">Notificaciones</span><button type="button" role="switch" aria-label={`Notificaciones: ${label}`} aria-checked={state === "active"} disabled={busy || !canToggle} onClick={state === "active" ? deactivate : activate} className={`inline-flex h-7 w-[3.25rem] shrink-0 items-center overflow-hidden rounded-full border p-0.5 transition-colors ${state === "active" ? "border-yellow-300 bg-yellow-400" : "border-zinc-600 bg-zinc-800"} disabled:opacity-50`}><span className={`size-[1.375rem] shrink-0 rounded-full bg-white shadow-sm transition-transform ${state === "active" ? "translate-x-6" : "translate-x-0"}`} /></button></div>
      {(contextualMessage || !canToggle) && <p role="status" className="mt-2 text-[11px] leading-relaxed text-zinc-500">{contextualMessage || label}</p>}
      {diagnostics}
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

      {diagnostics}
      {(state === "inactive" || state === "error" || (state === "blocked" && nativeEnvironment)) && (
        <button
          disabled={busy}
          type="button"
          onClick={state === "blocked" && nativeEnvironment ? openNotificationSettings : activate}
          className="mt-4 rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50"
        >
          {busy ? "Comprobando…" : state === "blocked" && nativeEnvironment ? "Activar desde configuración" : "Activar notificaciones"}
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
