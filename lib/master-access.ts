export type MasterEntryDestination = "/platform/trainers" | null;

export function masterEntryDestination(input: {
  platformOwnerValid: boolean;
}): MasterEntryDestination {
  if (input.platformOwnerValid) return "/platform/trainers";
  return null;
}

/** A login may resume only a platform route, never another origin or another portal. */
export function masterReturnPath(requested: string | null | undefined): string {
  const fallback = "/platform/trainers";
  if (!requested?.startsWith("/") || requested.startsWith("//") || requested.includes("\\")) return fallback;
  try {
    const url = new URL(requested, "https://bm.internal");
    if (url.origin !== "https://bm.internal" || (url.pathname !== "/platform" && !url.pathname.startsWith("/platform/"))) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
