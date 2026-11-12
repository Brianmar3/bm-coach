type AvatarResponse = {
  success?: boolean;
  photoUrl?: string;
  url?: string;
  message?: string;
  error?: string;
};

export async function readAvatarResponse(response: Response): Promise<AvatarResponse> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      response.ok
        ? "El servidor no confirmó el cambio de avatar."
        : "El servidor no pudo procesar el avatar.",
    );
  }
  if (!(response.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    throw new Error("El servidor devolvió una respuesta no válida.");
  }
  try {
    return JSON.parse(text) as AvatarResponse;
  } catch {
    throw new Error("El servidor devolvió una respuesta no válida.");
  }
}

export function announceProfilePhoto(photoUrl: string) {
  window.dispatchEvent(new CustomEvent("bm:profile-photo-updated", { detail: { photoUrl } }));
  window.dispatchEvent(new Event("bm:portal-data-refresh"));
}
