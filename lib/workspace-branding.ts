export const BM_DEFAULT_ACCENT = "#D4A72C";

const HEX_COLOR = /^#[0-9A-F]{6}$/;

export function normalizeAccentColor(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return HEX_COLOR.test(normalized) ? normalized : null;
}

export function workspaceAccentColor(value: unknown) {
  return normalizeAccentColor(value) ?? BM_DEFAULT_ACCENT;
}

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
