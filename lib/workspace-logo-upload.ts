export const MAX_WORKSPACE_LOGO_BYTES = 3 * 1024 * 1024;

export type WorkspaceLogoMime = "image/jpeg" | "image/png" | "image/webp";
export type WorkspaceLogoFileType = { mime: WorkspaceLogoMime; extension: "jpg" | "png" | "webp" };

const ALLOWED_MIME_TYPES = new Set<WorkspaceLogoMime>(["image/jpeg", "image/png", "image/webp"]);
const UNSPECIFIED_MIME_TYPES = new Set(["", "application/octet-stream", "binary/octet-stream"]);

export function normalizeWorkspaceLogoMime(value: unknown): WorkspaceLogoMime | "" | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().split(";", 1)[0];
  if (UNSPECIFIED_MIME_TYPES.has(normalized)) return "";
  if (normalized === "image/jpg") return "image/jpeg";
  return ALLOWED_MIME_TYPES.has(normalized as WorkspaceLogoMime) ? normalized as WorkspaceLogoMime : null;
}

export function workspaceLogoMetadataError(file: { size: number; type: string }) {
  if (!Number.isFinite(file.size) || file.size <= 0) return "Seleccioná un logo.";
  if (file.size > MAX_WORKSPACE_LOGO_BYTES) return "El logo supera el máximo de 3 MB.";
  if (normalizeWorkspaceLogoMime(file.type) === null) return "El logo debe ser PNG, JPG o WEBP.";
  return null;
}

export function detectWorkspaceLogoType(bytes: Uint8Array): WorkspaceLogoFileType | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg", extension: "jpg" };
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length >= 8 && bytes.slice(0, 8).every((value, index) => value === png[index])) return { mime: "image/png", extension: "png" };
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return { mime: "image/webp", extension: "webp" };
  return null;
}

export function validateWorkspaceLogoBytes(bytes: Uint8Array, declaredType: string) {
  const detected = detectWorkspaceLogoType(bytes);
  const declared = normalizeWorkspaceLogoMime(declaredType);
  if (!detected || declared === null || (declared && declared !== detected.mime)) return null;
  return detected;
}
