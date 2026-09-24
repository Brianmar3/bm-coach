import "server-only";
import { del, get, put } from "@vercel/blob";
import { ownedStudentBlob } from "@/lib/student-media";
import { validateWorkspaceLogoBytes } from "@/lib/workspace-logo-upload";

export function studentPhotoToken() { return process.env.STUDENT_PHOTOS_BLOB_READ_WRITE_TOKEN; }

export async function uploadStudentPhoto(path: string, bytes: Uint8Array, contentType: string) {
  const token = studentPhotoToken();
  if (!token) throw new Error("STUDENT_PHOTOS_STORAGE_NOT_CONFIGURED");
  const result = await put(path, Buffer.from(bytes), { access: "private", contentType, addRandomSuffix: false, token });
  const url = new URL(result.url);
  if (url.protocol !== "https:" || !/^[a-z0-9-]+\.private\.blob\.vercel-storage\.com$/.test(url.hostname) || url.pathname !== `/${path}`) {
    throw new Error("STUDENT_PHOTOS_PRIVATE_STORE_REQUIRED");
  }
  return result;
}

export async function removeStudentPhoto(source: string, studentId: string, kind: "profile" | "progress", logId?: string) {
  const blob = ownedStudentBlob(source, studentId, kind, logId);
  if (!blob) return;
  const token = blob.access === "private" ? studentPhotoToken() : process.env.STUDENT_PHOTOS_LEGACY_BLOB_READ_WRITE_TOKEN;
  // No guessing stores; missing legacy credentials leave a cleanup item for migration.
  if (!token) { console.warn("STUDENT_PHOTO_CLEANUP_PENDING"); return; }
  try { await del(blob.url, { token }); } catch { console.warn("STUDENT_PHOTO_CLEANUP_PENDING"); }
}

export async function readStudentPhoto(source: string, studentId: string, kind: "profile" | "progress", logId?: string) {
  const blob = ownedStudentBlob(source, studentId, kind, logId);
  if (!blob) return null;
  let stream: ReadableStream<Uint8Array> | null;
  if (blob.access === "private") {
    const token = studentPhotoToken();
    if (!token) throw new Error("STUDENT_PHOTOS_STORAGE_NOT_CONFIGURED");
    const result = await get(blob.url, { access: "private", token, useCache: false, abortSignal: AbortSignal.timeout(10000) });
    stream = result?.stream ?? null;
  } else {
    // Compatibility only; the old public origin remains public until migration.
    const response = await fetch(blob.url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error("STUDENT_PHOTOS_STORAGE_UNAVAILABLE");
    stream = response.body;
  }
  if (!stream) return null;
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 3 * 1024 * 1024) return null;
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); }
  const bytes = new Uint8Array(Buffer.concat(chunks));
  const type = validateWorkspaceLogoBytes(bytes, "application/octet-stream");
  return type ? { bytes, contentType: type.mime } : null;
}
