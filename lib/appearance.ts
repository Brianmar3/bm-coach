export const APPEARANCE_STORAGE_KEY = "bm-appearance-v1";
export const APPEARANCE_CHANGE_EVENT = "bm:appearance-change";

export type AppearancePreference = "dark" | "light" | "system";
export type ResolvedAppearance = "dark" | "light";
let sessionPreference: AppearancePreference | null = null;

export function parseAppearancePreference(value: string | null | undefined): AppearancePreference {
  return value === "light" || value === "system" ? value : "dark";
}

export function resolveAppearance(preference: AppearancePreference, systemIsDark: boolean): ResolvedAppearance {
  return preference === "system" ? (systemIsDark ? "dark" : "light") : preference;
}

export function readAppearancePreference(): AppearancePreference {
  try {
    const stored = window.localStorage.getItem(APPEARANCE_STORAGE_KEY);
    return stored === null ? sessionPreference ?? "dark" : parseAppearancePreference(stored);
  } catch {
    return sessionPreference ?? "dark";
  }
}

export function applyAppearance(preference: AppearancePreference): void {
  const systemIsDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true;
  const resolved = resolveAppearance(preference, systemIsDark);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.appearance = preference;
  document.documentElement.style.colorScheme = resolved;
}

export function setAppearancePreference(preference: AppearancePreference): void {
  sessionPreference = preference;
  try {
    window.localStorage.setItem(APPEARANCE_STORAGE_KEY, preference);
  } catch {
    // La preferencia sigue funcionando durante esta sesión aunque el storage esté bloqueado.
  }
  applyAppearance(preference);
  window.dispatchEvent(new Event(APPEARANCE_CHANGE_EVENT));
}
