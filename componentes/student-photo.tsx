"use client";

import { useState, type ImgHTMLAttributes } from "react";
import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatars";

export function StudentPhoto({ src, alt = "", ...props }: Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const unavailable = !src || failed === src;
  // Authenticated images must not go through a shared image optimizer/cache.
  // eslint-disable-next-line @next/next/no-img-element
  return <img {...props} src={unavailable ? DEFAULT_PROFILE_AVATAR.src : src} alt={alt}
    title={failed === src ? "No se pudo cargar la imagen. Actualizá para reintentar." : props.title}
    onError={() => { if (src && failed !== src) setFailed(src); }} />;
}
