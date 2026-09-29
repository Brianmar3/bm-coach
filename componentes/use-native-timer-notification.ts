"use client";

import { App } from "@capacitor/app";
import { useCallback, useEffect, useRef } from "react";
import {
  cancelNativeTimerNotification,
  nativeTimerNotificationsAvailable,
  requestNativeTimerNotificationPermission,
  scheduleNativeTimerNotification,
  type NativeTimerNotification,
} from "@/lib/native-timer-notifications";

type TimerNotificationOptions = NativeTimerNotification & {
  running: boolean;
  onForeground?: () => void;
};

export function useNativeTimerNotification(options: TimerNotificationOptions) {
  const latest = useRef(options);
  const scheduledId = useRef<number | null>(null);
  const operation = useRef(0);

  useEffect(() => {
    latest.current = options;
  }, [options]);

  const cancel = useCallback(async () => {
    operation.current += 1;
    const id = scheduledId.current;
    scheduledId.current = null;
    await cancelNativeTimerNotification(id);
  }, []);

  const schedule = useCallback(async () => {
    const version = ++operation.current;
    const previousId = scheduledId.current;
    scheduledId.current = null;
    await cancelNativeTimerNotification(previousId);
    const current = latest.current;
    if (!current.running || current.endAt <= Date.now()) return;
    const id = await scheduleNativeTimerNotification(current).catch(() => null);
    if (version !== operation.current) {
      if (scheduledId.current !== id) await cancelNativeTimerNotification(id);
      return;
    }
    scheduledId.current = id;
  }, []);

  const prepare = useCallback(() => {
    void requestNativeTimerNotificationPermission();
  }, []);

  const foreground = useCallback(() => {
    void cancel();
    latest.current.onForeground?.();
  }, [cancel]);

  useEffect(() => {
    if (!nativeTimerNotificationsAvailable()) return;
    let disposed = false;
    let appListener: Awaited<ReturnType<typeof App.addListener>> | null = null;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (isActive) foreground();
      else void schedule();
    }).then((listener) => {
      if (disposed) void listener.remove();
      else appListener = listener;
    });
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") foreground();
      else void schedule();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibilityChange);
      void appListener?.remove();
    };
  }, [foreground, schedule]);

  useEffect(() => {
    if (!nativeTimerNotificationsAvailable()) return;
    if (options.running && document.visibilityState !== "visible") void schedule();
    if (!options.running && document.visibilityState === "visible") void cancel();
  }, [cancel, options.endAt, options.key, options.running, schedule]);

  return { cancelNativeNotification: cancel, prepareNativeNotification: prepare };
}
