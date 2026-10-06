"use client";

import { useSyncExternalStore } from "react";
import { APPEARANCE_CHANGE_EVENT, APPEARANCE_STORAGE_KEY, applyAppearance, readAppearancePreference, setAppearancePreference, type AppearancePreference } from "@/lib/appearance";

const choices: { value: AppearancePreference; label: string; description: string }[] = [
  { value: "dark", label: "Oscuro", description: "La apariencia clásica de BM Training." },
  { value: "light", label: "Claro", description: "Superficies claras y contraste suave." },
  { value: "system", label: "Sistema", description: "Sigue la apariencia de este dispositivo." },
];

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  const onSystemChange = () => { if (readAppearancePreference() === "system") applyAppearance("system"); onChange(); };
  const onStorage = (event: StorageEvent) => { if (event.key === APPEARANCE_STORAGE_KEY) { applyAppearance(readAppearancePreference()); onChange(); } };
  window.addEventListener(APPEARANCE_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  media?.addEventListener("change", onSystemChange);
  return () => {
    window.removeEventListener(APPEARANCE_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
    media?.removeEventListener("change", onSystemChange);
  };
}

export function AppearanceSelector() {
  const hydrated = useSyncExternalStore(() => () => {}, () => true, () => false);
  const preference = useSyncExternalStore(subscribe, readAppearancePreference, () => "dark" as const);
  if (!hydrated) return <div className="min-h-32 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-soft)]" aria-hidden="true" />;
  return <fieldset className="appearance-selector">
    <legend className="sr-only">Apariencia</legend>
    <div className="grid gap-2 sm:grid-cols-3">
      {choices.map((choice) => <label key={choice.value} className="appearance-choice cursor-pointer rounded-xl border p-4 transition-colors">
        <input type="radio" name="appearance" value={choice.value} checked={preference === choice.value} onChange={() => setAppearancePreference(choice.value)} className="accent-yellow-500" />
        <span className="ml-2 font-semibold">{choice.label}</span>
        <span className="mt-1 block text-sm text-[var(--foreground-muted)]">{choice.description}</span>
      </label>)}
    </div>
    <p className="mt-3 text-xs text-[var(--foreground-muted)]">Se aplica ahora y se guarda sólo en este dispositivo. No cambia la marca ni las preferencias de tus alumnos.</p>
  </fieldset>;
}
