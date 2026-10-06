"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatars";
import { BmProfileIcon } from "@/componentes/icons";

export function StudentPhoto({ src, alt = "", ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const [fallbackFailed, setFallbackFailed] = useState(false);
  const unavailable = !src || failed === src;
  if (fallbackFailed && unavailable) return <span className={`${props.className ?? ""} inline-grid place-items-center bg-[var(--surface)] text-[var(--foreground-muted)]`} style={{ width: props.width, height: props.height, ...props.style }} role={alt ? "img" : undefined} aria-label={alt || undefined} aria-hidden={!alt}><BmProfileIcon size={20} /></span>;
  // Authenticated images must not go through a shared image optimizer/cache.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={unavailable ? DEFAULT_PROFILE_AVATAR.src : src} alt={alt}
    title={failed === src ? "No se pudo cargar la imagen. Actualizá para reintentar." : props.title}
    onError={() => { if (unavailable || src === DEFAULT_PROFILE_AVATAR.src) { setFallbackFailed(true); setFailed(src ?? null); } else setFailed(src!); }} />;
}
