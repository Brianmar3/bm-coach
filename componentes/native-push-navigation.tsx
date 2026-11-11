"use client";

import { useEffect } from "react";

export function NativePushNavigation() {
  useEffect(() => {
    let disposed = false;
    let remove: (() => Promise<void>) | undefined;
    void (async () => {
      const { Capacitor } = await import("@capacitor/core");
      if (disposed || Capacitor.getPlatform() !== "android") return;
      const { listenForNativePushActions } = await import("@/lib/native-push-client");
      if (disposed) return;
      const listener = await listenForNativePushActions();
      if (disposed) await listener.remove();
      else remove = () => listener.remove();
    })().catch(() => {});
    return () => {
      disposed = true;
      void remove?.().catch(() => {});
    };
  }, []);
  return null;
}
