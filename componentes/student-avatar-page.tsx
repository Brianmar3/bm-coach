"use client";
/* eslint-disable @next/next/no-img-element -- bundled avatar assets are validated by the avatar registry tests */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DEFAULT_PROFILE_AVATAR, PROFILE_AVATARS } from "@/lib/profile-avatars";
import type { PortalProfile } from "@/types/portal";

type AvatarResponse = {
  success?: boolean;
  photoUrl?: string;
  url?: string;
  message?: string;
  error?: string;
};

const avatarGroups = ["Personajes", "Equipamiento"] as const;

async function readAvatarResponse(response: Response): Promise<AvatarResponse> {
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

export function StudentAvatarPage({ profile }: { profile: PortalProfile }) {
  const router = useRouter();
  const initialAvatar =
    PROFILE_AVATARS.find((avatar) => avatar.src === profile.profileImageUrl) ??
    DEFAULT_PROFILE_AVATAR;
  const [avatarChoice, setAvatarChoice] = useState(initialAvatar.id);
  const [savedAvatarId, setSavedAvatarId] = useState(initialAvatar.id);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const selectedAvatar =
    PROFILE_AVATARS.find((avatar) => avatar.id === avatarChoice) ??
    DEFAULT_PROFILE_AVATAR;

  async function saveAvatar() {
    if (!avatarChoice || savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/portal/profile-photo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: avatarChoice }),
      });
      const body = await readAvatarResponse(response);
      const nextAvatarUrl = body.photoUrl ?? body.url;
      if (!response.ok || body.success === false || !nextAvatarUrl) {
        throw new Error(body.error ?? "No se pudo guardar el avatar.");
      }
      setSavedAvatarId(avatarChoice);
      setMessage(body.message ?? "Avatar actualizado correctamente.");
      window.dispatchEvent(
        new CustomEvent("bm:profile-photo-updated", {
          detail: { photoUrl: nextAvatarUrl },
        }),
      );
      router.refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No se pudo guardar el avatar.",
      );
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 overflow-x-clip">
      <Link
        href="/portal/perfil"
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-800 px-4 text-sm font-bold text-zinc-300 transition hover:border-yellow-400/30 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
      >
        <span aria-hidden="true">←</span> Volver
      </Link>

      <header>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-yellow-400">
          BM Training
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white">
          Elegí tu avatar
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Elegí el avatar que más te represente.
        </p>
      </header>

      <section aria-labelledby="current-avatar-title">
        <h2 id="current-avatar-title" className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-400">
          Avatar actual
        </h2>
        <div className="mt-2 flex items-center gap-4 rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-[#0b0b0b] p-4 shadow-[0_14px_34px_rgba(0,0,0,.24)]">
          <img
            src={selectedAvatar.src}
            alt=""
            className="size-20 shrink-0 rounded-full border border-yellow-400/30 bg-black object-cover"
          />
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-yellow-200">
              {selectedAvatar.label}
            </p>
            <p className="mt-1 text-sm text-zinc-500">{selectedAvatar.category}</p>
            {avatarChoice !== savedAvatarId && (
              <p className="mt-2 text-xs font-semibold text-yellow-400">Cambio sin guardar</p>
            )}
          </div>
        </div>
      </section>

      {avatarGroups.map((group) => (
        <section key={group} aria-labelledby={`avatar-group-${group.toLowerCase()}`}>
          <h2 id={`avatar-group-${group.toLowerCase()}`} className="text-[10px] font-black uppercase tracking-[.18em] text-yellow-400">
            {group}
          </h2>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3" role="group" aria-label={`Avatares: ${group}`}>
            {PROFILE_AVATARS.filter((avatar) => avatar.category === group).map((avatar) => {
              const selected = avatarChoice === avatar.id;
              return (
                <button
                  key={avatar.id}
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setAvatarChoice(avatar.id);
                    setError("");
                    setMessage("");
                  }}
                  aria-label={`Elegir avatar ${avatar.label}`}
                  aria-pressed={selected}
                  className={`min-w-0 rounded-2xl border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 ${
                    selected
                      ? "border-yellow-300 bg-yellow-400/10 shadow-[0_0_18px_rgba(250,204,21,.1)]"
                      : "border-zinc-800 bg-black hover:border-yellow-400/35"
                  }`}
                >
                  <img src={avatar.src} alt="" className="mx-auto aspect-square w-full rounded-full object-cover" />
                  <span className="mt-2 block truncate text-[10px] font-semibold text-zinc-300 sm:text-xs">
                    {avatar.label}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      <section className="rounded-2xl border border-white/[.07] bg-zinc-900/80 p-4">
        {error && <p role="alert" className="mb-3 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
        {message && <p role="status" className="mb-3 rounded-xl bg-emerald-400/10 p-3 text-sm text-emerald-300">{message}</p>}
        <button
          type="button"
          onClick={saveAvatar}
          disabled={saving || avatarChoice === savedAvatarId}
          className="min-h-12 w-full rounded-xl bg-yellow-400 px-4 font-black text-zinc-950 transition hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Guardando…" : avatarChoice === savedAvatarId ? "Avatar guardado" : "Guardar avatar"}
        </button>
      </section>
    </div>
  );
}
