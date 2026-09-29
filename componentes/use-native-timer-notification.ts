"use client";

import { App } from "@capacitor/app";
import { useCallback, useEffect, useRef } from "react";
import { getActiveNativeTimer, nativeTimerNotificationsAvailable, requestNativeTimerNotificationPermission, startNativeTimer, stopNativeTimer, type NativeActiveTimer, type NativeTimerNotification } from "@/lib/native-timer-notifications";

type TimerNotificationOptions = NativeTimerNotification & {
  running: boolean;
  onForeground?: (active: NativeActiveTimer | null) => void;
};

export function useNativeTimerNotification(options: TimerNotificationOptions) {
  const latest = useRef(options);
  useEffect(() => { latest.current = options; }, [options]);

  const start = useCallback((notification?: NativeTimerNotification) => startNativeTimer(notification ?? latest.current), []);
  const stop = useCallback((timerId?: string) => stopNativeTimer(timerId ?? latest.current.key), []);
  const prepare = useCallback(() => { void requestNativeTimerNotificationPermission(); }, []);
  const reconcile = useCallback(async () => {
    const active = await getActiveNativeTimer();
    latest.current.onForeground?.(active);
  }, []);

  useEffect(() => {
    if (!nativeTimerNotificationsAvailable()) return;
    let disposed = false;
    let appListener: Awaited<ReturnType<typeof App.addListener>> | null = null;
    void App.addListener("appStateChange", ({ isActive }) => { if (isActive) void reconcile(); }).then((listener) => {
      if (disposed) void listener.remove(); else appListener = listener;
    });
    const onVisibilityChange = () => { if (document.visibilityState === "visible") void reconcile(); };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { disposed = true; document.removeEventListener("visibilitychange", onVisibilityChange); void appListener?.remove(); };
  }, [reconcile]);

  return { cancelNativeNotification: stop, prepareNativeNotification: prepare, startNativeNotification: start, reconcileNativeNotification: reconcile };
}
