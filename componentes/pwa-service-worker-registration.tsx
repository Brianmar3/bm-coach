"use client";

import { useEffect } from "react";
import { finishOfflineLogout } from "@/lib/offline-training-client";

export function PwaServiceWorkerRegistration() {
  useEffect(() => {
    const finishLogout = () => { void finishOfflineLogout().catch(() => {}); };
    finishLogout(); window.addEventListener("online", finishLogout);
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;
    void navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    }).catch((error: unknown) => {
      console.error("No se pudo registrar el service worker de BM Training", error);
    });
    return () => window.removeEventListener("online", finishLogout);
  }, []);

  return null;
}
