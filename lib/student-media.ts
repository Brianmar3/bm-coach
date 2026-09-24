export type StudentMediaKind = "profile" | "ranking" | "progress";
export type MediaStudent = { id: string; workspaceId: string; selfService: boolean };
export type MediaActor =
  | { type: "student"; studentId: string; workspaceId: string; selfService: boolean }
  | { type: "trainer"; workspaceId: string };

export function canReadStudentMedia(actor: MediaActor | null, owner: MediaStudent, kind: StudentMediaKind, rankingVisible = false) {
  if (!actor || !owner.workspaceId || actor.workspaceId !== owner.workspaceId) return false;
  if (actor.type === "trainer") return !owner.selfService;
  if (actor.studentId === owner.id) return kind !== "ranking" || (!actor.selfService && rankingVisible);
  return kind === "ranking" && !actor.selfService && !owner.selfService && rankingVisible;
}

// Only stored Blob URLs with an exact owner prefix are readable/deletable. Never a client URL.
export function ownedStudentBlob(value: unknown, studentId: string, kind: "profile" | "progress", logId?: string) {
  if (typeof value !== "string" || !studentId || !/^[\w-]+$/.test(studentId)) return null;
  if (kind === "progress" && (!logId || !/^[\w-]+$/.test(logId))) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.port || url.search || url.hash ||
        !/^[a-z0-9-]+\.(public|private)\.blob\.vercel-storage\.com$/.test(url.hostname)) return null;
    const prefix = kind === "profile" ? `/student-profile/${studentId}/` : `/quick-logs/${studentId}/${logId}/`;
    if (!url.pathname.startsWith(prefix) || !/^[\w-]+\.(png|jpg|jpeg|webp)$/.test(url.pathname.slice(prefix.length))) return null;
    return { url: url.href, access: url.hostname.includes(".private.") ? "private" as const : "public" as const };
  } catch { return null; }
}

export function studentMediaPath(kind: StudentMediaKind, id: string) {
  return `/api/portal/media/${kind}/${encodeURIComponent(id)}`;
}

export function studentProfilePhoto(id: string, source: unknown, ranking = false) {
  if (typeof source !== "string" || !source) return "";
  if (/^\/avatars\/[\w-]+\.(webp|png)$/.test(source)) return source;
  if (!ownedStudentBlob(source, id, "profile")) return "";
  // Non-secret render revision: changing a photo changes src without exposing its Blob URL.
  let revision = 2166136261;
  for (const char of source) revision = Math.imul(revision ^ char.charCodeAt(0), 16777619);
  return `${studentMediaPath(ranking ? "ranking" : "profile", id)}?v=${revision >>> 0}`;
}

export function publicStudent<T extends { profileImageUrl?: unknown }>(id: string, data: T) {
  return { ...data, profileImageUrl: studentProfilePhoto(id, data.profileImageUrl) };
}

export const STUDENT_MEDIA_HEADERS = { "Cache-Control": "private, no-store", Vary: "Cookie", "X-Content-Type-Options": "nosniff" };

export function missingStudentImage() {
  return new Response('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#18181b"/><circle cx="50" cy="35" r="16" fill="#a1a1aa"/><path d="M18 90a32 32 0 0 1 64 0" fill="#a1a1aa"/><title>Imagen no disponible</title></svg>', {
    headers: { ...STUDENT_MEDIA_HEADERS, "Content-Type": "image/svg+xml", "Content-Security-Policy": "default-src 'none'; sandbox" },
  });
}
