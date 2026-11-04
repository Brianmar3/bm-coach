"use client";

import { createPortal } from "react-dom";
import { KeyboardDialog } from "@/componentes/keyboard-dialog";
import { BmBellIcon, BmCheckIcon, BmCloseIcon } from "@/componentes/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  checkNativePushPermissions,
  getNativePushEnvironment,
  nativePermissionState,
  nativePushEndpoint,
  openNativeNotificationSettings,
  registerNativePushDevice,
  requestNativePushPermissions,
  type NativePushAudience,
  type NativePushEnvironment,
} from "@/lib/native-push-client";

let onboardingOwner: symbol | null = null;

const REMIND_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

type SavedDecision = { decidedAt: number; result: "later" | "denied" | "blocked" };

function decisionKey(audience: NativePushAudience, appId: string) {
  return `bm-native-push-onboarding-v1:${audience}:${appId}`;
}

function recentDecision(key: string) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as SavedDecision | null;
    return Boolean(parsed && Date.now() - parsed.decidedAt < REMIND_AFTER_MS);
  } catch {
    return false;
  }
}

function saveDecision(key: string, result: SavedDecision["result"]) {
  localStorage.setItem(key, JSON.stringify({ decidedAt: Date.now(), result }));
}

export function NativePushOnboarding({ audience }: { audience: NativePushAudience }) {
  const [environment, setEnvironment] = useState<NativePushEnvironment | null>(null);
  const [mode, setMode] = useState<"hidden" | "prompt" | "blocked" | "success">("hidden");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const registered = useRef(false);
  const owner = useRef(Symbol("native-push-onboarding"));
  const interacting = useRef(false);
  const reconciling = useRef(false);

  useEffect(() => {
    const currentOwner = owner.current;
    return () => { if (onboardingOwner === currentOwner) onboardingOwner = null; };
  }, []);

  const reconcile = useCallback(async () => {
    if (interacting.current || reconciling.current || (onboardingOwner && onboardingOwner !== owner.current)) return;
    onboardingOwner = owner.current;
    reconciling.current = true;
    try {
    const detected = environment ?? await getNativePushEnvironment();
    if (!detected) return;
    setEnvironment(detected);
    const endpoint = nativePushEndpoint(audience);
    const configuration = await fetch(
      `${endpoint}?appId=${encodeURIComponent(detected.appId)}`,
      { cache: "no-store" },
    );
    if (!configuration.ok) return;
    const config = await configuration.json() as { configured?: boolean };
    if (!config.configured) return;
    const permission = await checkNativePushPermissions();
    const state = nativePermissionState(permission);
    const key = decisionKey(audience, detected.appId);
    if (state === "granted") {
      localStorage.removeItem(key);
      setMode("hidden");
      if (!registered.current) {
        registered.current = true;
        await registerNativePushDevice(audience, detected).catch(() => {
          registered.current = false;
          setMessage("El permiso está concedido, pero no pudimos registrar este dispositivo. Revisá la conexión y reintentá.");
          setMode("prompt");
        });
      }
      return;
    }
    registered.current = false;
    if (recentDecision(key)) {
      setMode("hidden");
      return;
    }
    if (!interacting.current) setMode(state === "blocked" ? "blocked" : "prompt");
    } finally { reconciling.current = false; }
  }, [audience, environment]);

  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (!cancelled && document.visibilityState !== "hidden") {
        void reconcile().catch(() => undefined);
      }
    };
    run();
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [reconcile]);

  async function activate() {
    if (!environment || interacting.current) return;
    interacting.current = true;
    setBusy(true);
    setMessage("");
    const key = decisionKey(audience, environment.appId);
    let activated = false;
    try {
      let permission = await checkNativePushPermissions();
      if (nativePermissionState(permission) === "blocked") {
        saveDecision(key, "blocked");
        setMode("hidden");
        await openNativeNotificationSettings();
        return;
      }
      if (permission.receive !== "granted") {
        permission = await requestNativePushPermissions();
      }
      if (permission.receive !== "granted") {
        saveDecision(
          key,
          nativePermissionState(permission) === "blocked" ? "blocked" : "denied",
        );
        setMode("blocked");
        setMessage("No se concedió el permiso. Podés activarlo más adelante desde la configuración del dispositivo.");
        return;
      }
      const registration = await registerNativePushDevice(audience, environment);
      if (!registration.token?.trim() || (await checkNativePushPermissions()).receive !== "granted") throw new Error("NOTIFICATIONS_NOT_ENABLED");
      registered.current = true;
      localStorage.removeItem(key);
      activated = true;
      setMode("success");

    } catch {
      setMessage("No pudimos activar las notificaciones. Revisá tu conexión e intentá nuevamente.");
    } finally {
      if (!activated) interacting.current = false;
      setBusy(false);
    }
  }

  function dismiss() {
    if (busy) return;
    if (mode !== "success" && environment) {
      saveDecision(
        decisionKey(audience, environment.appId),
        mode === "blocked" ? "blocked" : "later",
      );
    }
    setMode("hidden");
  }

  useEffect(() => {
    if (mode === "hidden") return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [mode]);
  useEffect(() => {
    if (mode !== "success") return;
    // Keep foreground reconciliation from dismissing the verified celebration.
    interacting.current = true;
    const timer = window.setTimeout(() => { interacting.current = false; setMode("hidden"); }, 4000);
    return () => { window.clearTimeout(timer); interacting.current = false; };
  }, [mode]);

  if (mode === "hidden") return null;
  return createPortal(
    <div className="fixed inset-0 z-[220] grid place-items-center overflow-y-auto bg-black/55 px-5 py-[max(1.25rem,env(safe-area-inset-top),env(safe-area-inset-bottom))] backdrop-blur-sm" role="presentation">
      <KeyboardDialog as="section" onClose={dismiss} dismissible={!busy} priority={110} aria-labelledby="native-push-title" aria-describedby="native-push-description" className="onboarding-enter relative my-auto w-full max-w-sm rounded-3xl border border-yellow-500/35 bg-[var(--surface,#111)] p-6 text-center text-[var(--foreground)] shadow-2xl outline-none motion-reduce:animate-none sm:p-7">
        <button type="button" disabled={busy} onClick={dismiss} aria-label="Cerrar aviso de notificaciones" className="absolute right-2 top-2 grid size-10 place-items-center rounded-full text-[var(--foreground-muted)] hover:bg-[var(--surface-soft)] focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] disabled:opacity-40"><BmCloseIcon size={18}/></button>
        <div className="relative mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-yellow-500/25 bg-yellow-400/10 text-[var(--brand-text)]" aria-hidden="true"><BmBellIcon size={32}/>{mode === "success" && <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-[var(--surface,#111)] bg-yellow-400 text-zinc-950"><BmCheckIcon size={15}/></span>}</div>
        <h2 id="native-push-title" className="text-xl font-bold leading-tight">{mode === "success" ? "¡Notificaciones activadas!" : "Activá las notificaciones"}</h2>
        <p id="native-push-description" className="mt-3 text-sm leading-relaxed text-[var(--foreground-muted)]">{mode === "success" ? "Listo, ahora vas a recibir tus avisos importantes" : "Recibí avisos de tus clases, entrenamientos y novedades importantes"}</p>
        {mode === "blocked" && <p role="status" className="mt-3 text-xs leading-relaxed text-[var(--foreground-muted)]">El permiso está desactivado. Podés habilitarlo desde la configuración del dispositivo.</p>}
        {message && <p role="status" className="mt-3 text-xs leading-relaxed text-[var(--foreground)]">{message}</p>}
        <div className="mt-5 flex flex-col gap-1">
          {mode === "success" ? <button type="button" onClick={dismiss} className="min-h-11 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400">Entendido</button> : <><button type="button" disabled={busy} onClick={activate} className="min-h-11 rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-400 disabled:opacity-50">{busy ? "Comprobando…" : mode === "blocked" ? "Activar desde configuración" : "Activar notificaciones"}</button><button type="button" disabled={busy} onClick={dismiss} className="min-h-11 rounded-xl px-4 text-sm text-[var(--foreground-muted)] focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] disabled:opacity-50">Ahora no</button></>}
        </div>
      </KeyboardDialog>
    </div>, document.body,
  );
}
