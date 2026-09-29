"use client";

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

  const reconcile = useCallback(async () => {
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
        });
      }
      return;
    }
    registered.current = false;
    if (recentDecision(key)) {
      setMode("hidden");
      return;
    }
    setMode(state === "blocked" ? "blocked" : "prompt");
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
    if (!environment) return;
    setBusy(true);
    setMessage("");
    const key = decisionKey(audience, environment.appId);
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
        setMode("hidden");
        return;
      }
      await registerNativePushDevice(audience, environment);
      registered.current = true;
      localStorage.removeItem(key);
      setMode("success");
      window.setTimeout(() => setMode("hidden"), 1800);
    } catch {
      setMessage("No pudimos activar las notificaciones. Revisá tu conexión e intentá nuevamente.");
    } finally {
      setBusy(false);
    }
  }

  function dismiss() {
    if (environment) {
      saveDecision(
        decisionKey(audience, environment.appId),
        mode === "blocked" ? "blocked" : "later",
      );
    }
    setMode("hidden");
  }

  if (mode === "hidden") return null;
  return (
    <div className="fixed inset-0 z-[100] grid place-items-end bg-black/70 p-4 backdrop-blur-sm sm:place-items-center" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="native-push-title" className="w-full max-w-md rounded-3xl border border-yellow-400/35 bg-zinc-950 p-5 text-white shadow-2xl shadow-yellow-400/10">
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-yellow-400/15 text-2xl text-yellow-300" aria-hidden="true">●</div>
        <h2 id="native-push-title" className="text-xl font-bold">
          {mode === "success" ? "Notificaciones activadas" : "Activá las notificaciones"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {mode === "success"
            ? "Listo. Este dispositivo ya puede recibir avisos de BM Training."
            : "Recibí avisos de clases, entrenamientos, vencimientos y novedades de tu entrenador."}
        </p>
        {message && <p role="status" className="mt-3 text-sm text-yellow-200">{message}</p>}
        {mode !== "success" && <div className="mt-5 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" disabled={busy} onClick={activate} className="rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-950 disabled:opacity-50">
            {busy ? "Comprobando…" : mode === "blocked" ? "Activar desde configuración" : "Activar notificaciones"}
          </button>
          <button type="button" disabled={busy} onClick={dismiss} className="rounded-xl border border-zinc-700 px-4 py-3 text-sm font-semibold text-zinc-300 disabled:opacity-50">Ahora no</button>
        </div>}
      </section>
    </div>
  );
}
