"use client";

import { useEffect } from "react";
import { APPEARANCE_STORAGE_KEY, applyAppearance, readAppearancePreference } from "@/lib/appearance";

/** Mantiene Sistema sincronizado aun fuera de Configuración. */
export function AppearanceRuntime() {
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      if (readAppearancePreference() === "system") applyAppearance("system");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === APPEARANCE_STORAGE_KEY) applyAppearance(readAppearancePreference());
    };
    applyAppearance(readAppearancePreference());
    media?.addEventListener("change", onSystemChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media?.removeEventListener("change", onSystemChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  return null;
}
