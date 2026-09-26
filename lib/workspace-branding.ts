export const BM_DEFAULT_ACCENT = "#D4A72C";
export const WORKSPACE_LOGO_MODES = ["DEFAULT", "WHITE", "ACCENT", "CUSTOM"] as const;

export type WorkspaceLogoMode = typeof WORKSPACE_LOGO_MODES[number];
export type WorkspaceBranding = {
  accentColor: string;
  logoMode: WorkspaceLogoMode;
  customLogoUrl: string;
  displayName: string;
  isPremium: boolean;
  platformFallbackName: string;
};

export const PLATFORM_FALLBACK_NAME = "BM Training";

export const DEFAULT_WORKSPACE_BRANDING: WorkspaceBranding = {
  accentColor: BM_DEFAULT_ACCENT,
  logoMode: "DEFAULT",
  customLogoUrl: "",
  displayName: PLATFORM_FALLBACK_NAME,
  isPremium: false,
  platformFallbackName: PLATFORM_FALLBACK_NAME,
};

type BrandingPlan = "FREE" | "STARTER" | "PRO" | "PREMIUM";

const HEX_COLOR = /^#[0-9A-F]{6}$/;
export const MAX_WORKSPACE_NAME_LENGTH = 36;

export function normalizeWorkspaceName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name && name.length <= MAX_WORKSPACE_NAME_LENGTH ? name : null;
}

function normalizeBrandIdentity(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name && name.length <= 120 ? name : null;
}

export function normalizeAccentColor(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return HEX_COLOR.test(normalized) ? normalized : null;
}

export function workspaceAccentColor(value: unknown) {
  return normalizeAccentColor(value) ?? BM_DEFAULT_ACCENT;
}

export function normalizeLogoMode(value: unknown): WorkspaceLogoMode | null {
  return typeof value === "string" && WORKSPACE_LOGO_MODES.includes(value as WorkspaceLogoMode)
    ? value as WorkspaceLogoMode
    : null;
}

export function allowedLogoModes(plan: BrandingPlan) {
  if (plan === "PREMIUM") return WORKSPACE_LOGO_MODES;
  if (plan === "PRO") return WORKSPACE_LOGO_MODES.slice(0, 3);
  return WORKSPACE_LOGO_MODES.slice(0, 2);
}

export function normalizeCustomLogoUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com") ? url.toString() : "";
  } catch {
    return "";
  }
}

export function getWorkspaceBranding(
  data: {
    accentColor?: unknown;
    logoMode?: unknown;
    customLogoUrl?: unknown;
    businessName?: unknown;
    systemName?: unknown;
    workspaceName?: unknown;
    trainerDisplayName?: unknown;
  } | null | undefined,
  plan: BrandingPlan = "STARTER",
): WorkspaceBranding {
  const isPremium = plan === "PREMIUM";
  const requestedMode = normalizeLogoMode(data?.logoMode) ?? "DEFAULT";
  const customLogoUrl = normalizeCustomLogoUrl(data?.customLogoUrl);
  const logoMode = allowedLogoModes(plan).includes(requestedMode) && (requestedMode !== "CUSTOM" || customLogoUrl)
    ? requestedMode
    : "DEFAULT";
  const displayName = isPremium
    ? normalizeBrandIdentity(data?.businessName)
      ?? normalizeWorkspaceName(data?.systemName)
      ?? normalizeBrandIdentity(data?.workspaceName)
      ?? normalizeBrandIdentity(data?.trainerDisplayName)
      ?? PLATFORM_FALLBACK_NAME
    : PLATFORM_FALLBACK_NAME;
  return {
    accentColor: workspaceAccentColor(data?.accentColor),
    logoMode,
    customLogoUrl,
    displayName,
    isPremium,
    platformFallbackName: PLATFORM_FALLBACK_NAME,
  };
}

export const resolveWorkspaceBranding = getWorkspaceBranding;

function channel(hex: string, offset: number) {
  return Number.parseInt(hex.slice(offset, offset + 2), 16);
}

function mix(hex: string, target: number, amount: number) {
  const next = [1, 3, 5].map((offset) => Math.round(channel(hex, offset) * (1 - amount) + target * amount));
  return `#${next.map((value) => value.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function relativeLuminance(hex: string) {
  const linear = [1, 3, 5].map((offset) => {
    const value = channel(hex, offset) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
}

export function workspaceBrandingVariables(value: unknown) {
  const accent = workspaceAccentColor(value);
  return {
    "--bm-accent": accent,
    "--bm-accent-hover": mix(accent, relativeLuminance(accent) > 0.42 ? 0 : 255, 0.14),
    "--bm-accent-soft": `${accent}24`,
    "--bm-accent-contrast": relativeLuminance(accent) > 0.43 ? "#09090B" : "#FFFFFF",
  };
}
