import type { WorkspaceBranding } from "./workspace-branding";

// Identity images only; never general API responses or arbitrary remote media.
export const IDENTITY_CACHE = "bm-private-identity-v1";
export type OfflineIdentityImages = { avatar?: string; logo?: string; avatarSource?: string; logoSource?: string; savedAt?: number };
let generation = 0;
let writes: Promise<unknown> = Promise.resolve();
function key(scope: string) { return new URL(`/__bm_identity__/${encodeURIComponent(scope)}`, location.origin).href; }
export async function readOfflineIdentity(scope: string): Promise<OfflineIdentityImages> {
  if (!("caches" in globalThis)) return {};
  const response = await (await caches.open(IDENTITY_CACHE)).match(key(scope));
  return response ? await response.json() as OfflineIdentityImages : {};
}
export function identitySources(studentId: string, avatar: string, branding: Pick<WorkspaceBranding, "logoMode" | "customLogoUrl">) {
  const url = new URL(avatar || "/avatars/bm-shield-v3.webp", location.origin);
  const ownPhoto = url.pathname === `/api/portal/media/profile/${encodeURIComponent(studentId)}`;
  const preset = /^\/avatars\/[\w-]+\.webp$/.test(url.pathname);
  return {
    avatar: url.origin === location.origin && (ownPhoto || preset) ? `${url.pathname}${url.search}` : "/avatars/bm-shield-v3.webp",
    logo: branding.logoMode === "CUSTOM" && branding.customLogoUrl ? `/api/workspace/logo/image?source=${encodeURIComponent(branding.customLogoUrl)}` : "",
  };
}
async function imageCopy(source: string) {
  const response = await fetch(source, { cache: "no-store", credentials: "same-origin", signal: AbortSignal.timeout(15000) });
  if (!response.ok || !/^image\/(png|jpeg|webp|gif|avif)(;|$)/i.test(response.headers.get("content-type") ?? "")) throw new Error("Invalid identity image");
  const blob = await response.blob();
  if (!blob.size || blob.size > 5 * 1024 * 1024) throw new Error("Invalid identity image size");
  const decoded = await createImageBitmap(blob); decoded.close();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return `data:${blob.type};base64,${btoa(binary)}`;
}
export function saveOfflineIdentity(scope: string, studentId: string, avatar: string, branding: Pick<WorkspaceBranding, "logoMode" | "customLogoUrl">) {
  const epoch = generation;
  const work = writes.catch(() => {}).then(async () => {
    if (!navigator.onLine || !("caches" in globalThis) || epoch !== generation) return;
    const previous = await readOfflineIdentity(scope);
    const sources = identitySources(studentId, avatar, branding);
    if (previous.avatarSource === sources.avatar && previous.logoSource === sources.logo && Date.now() - (previous.savedAt ?? 0) < 60000) return;
    const [avatarCopy, logoCopy] = await Promise.allSettled([imageCopy(sources.avatar), sources.logo ? imageCopy(sources.logo) : Promise.resolve(undefined)]);
    if (epoch !== generation) return;
    const next: OfflineIdentityImages = { ...previous, savedAt: Date.now() };
    if (avatarCopy.status === "fulfilled") { next.avatar = avatarCopy.value; next.avatarSource = sources.avatar; }
    if (!sources.logo) { delete next.logo; next.logoSource = ""; }
    else if (logoCopy.status === "fulfilled") { next.logo = logoCopy.value; next.logoSource = sources.logo; }
    await (await caches.open(IDENTITY_CACHE)).put(key(scope), Response.json(next));
  });
  writes = work;
  return work;
}
export async function clearOfflineIdentity() {
  generation++;
  await writes.catch(() => {});
  if ("caches" in globalThis) await caches.delete(IDENTITY_CACHE);
}
