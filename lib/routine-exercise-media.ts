export type RoutineExerciseMedia = { hasMedia: boolean; source: "LIBRARY" | "MANUAL" | "NONE"; libraryExerciseId: string | null; mediaUrl: string | null; thumbnailUrl: string | null };
export type RoutineManualPlayback = { kind: "VIDEO" | "EMBED" | "UNAVAILABLE"; url: string | null };

const LIBRARY_MEDIA_PATH = "/api/exercise-library/media";
const LIBRARY_REFERENCE_PROTOCOL = "bm-library:";

export function libraryExerciseMediaUrl(id: string, kind: "thumbnail" | "gif" = "gif") {
  return `${LIBRARY_MEDIA_PATH}?id=${encodeURIComponent(id)}&kind=${kind}`;
}

export function libraryExerciseReferenceUrl(id: string) {
  return `${LIBRARY_REFERENCE_PROTOCOL}//exercise/${encodeURIComponent(id)}`;
}

export function libraryExerciseIdFromMediaUrl(value: string | null | undefined) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value, "https://bm-training.local");
    if (url.protocol === LIBRARY_REFERENCE_PROTOCOL && url.hostname === "exercise") {
      const id = decodeURIComponent(url.pathname.slice(1));
      return id || null;
    }
    return url.pathname === LIBRARY_MEDIA_PATH && url.searchParams.get("kind") === "gif" ? url.searchParams.get("id") : null;
  } catch { return null; }
}

export function resolveRoutineExerciseMedia(videoUrl: string | null | undefined, libraryMediaEnabled: boolean): RoutineExerciseMedia {
  const value = videoUrl?.trim() ?? "";
  const libraryExerciseId = libraryExerciseIdFromMediaUrl(value);
  if (libraryExerciseId) return libraryMediaEnabled
    ? { hasMedia: true, source: "LIBRARY", libraryExerciseId, mediaUrl: libraryExerciseMediaUrl(libraryExerciseId), thumbnailUrl: libraryExerciseMediaUrl(libraryExerciseId, "thumbnail") }
    : { hasMedia: false, source: "LIBRARY", libraryExerciseId, mediaUrl: null, thumbnailUrl: null };
  if (/^https?:\/\//i.test(value)) return { hasMedia: true, source: "MANUAL", libraryExerciseId: null, mediaUrl: value, thumbnailUrl: null };
  return { hasMedia: false, source: "NONE", libraryExerciseId: null, mediaUrl: null, thumbnailUrl: null };
}

export function resolveManualVideoPlayback(value: string | null | undefined): RoutineManualPlayback {
  if (!value) return { kind: "UNAVAILABLE", url: null };
  let url: URL;
  try { url = new URL(value); } catch { return { kind: "UNAVAILABLE", url: null }; }
  if (url.protocol !== "http:" && url.protocol !== "https:") return { kind: "UNAVAILABLE", url: null };
  if (/\.(mp4|webm|ogg|ogv|m4v|mov)(?:[?#]|$)/i.test(url.href)) return { kind: "VIDEO", url: url.href };

  const hostname = url.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  let youtubeId: string | null = null;
  if (hostname === "youtu.be") youtubeId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  if (hostname === "youtube.com" || hostname === "youtube-nocookie.com") {
    youtubeId = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/(?:embed|shorts)\/([\w-]+)/)?.[1] ?? null;
  }
  if (youtubeId && /^[\w-]{6,20}$/.test(youtubeId)) return { kind: "EMBED", url: `https://www.youtube-nocookie.com/embed/${youtubeId}` };

  if (hostname === "vimeo.com" || hostname === "player.vimeo.com") {
    const vimeoId = url.pathname.match(/(?:\/video)?\/(\d+)/)?.[1];
    if (vimeoId) return { kind: "EMBED", url: `https://player.vimeo.com/video/${vimeoId}` };
  }
  return { kind: "UNAVAILABLE", url: null };
}

export function isValidRoutineVideoUrl(value: string | undefined) {
  if (!value?.trim() || libraryExerciseIdFromMediaUrl(value)) return true;
  try { const url = new URL(value); return url.protocol === "http:" || url.protocol === "https:"; } catch { return false; }
}
