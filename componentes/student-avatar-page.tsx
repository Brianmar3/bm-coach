"use client";
/* eslint-disable @next/next/no-img-element -- bundled avatar assets are validated by the avatar registry tests */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useWorkspaceBranding } from "@/componentes/workspace-branding-provider";
import { PROFILE_AVATARS, profileAvatarById, profileAvatarBySrc } from "@/lib/profile-avatars";
import type { PortalProfile } from "@/types/portal";
import { BmCheckIcon } from "@/componentes/icons";
import { announceProfilePhoto, readAvatarResponse } from "@/lib/student-profile-photo-client";
import styles from "./student-avatar-page.module.css";

export function StudentAvatarPage({ profile }: { profile: PortalProfile }) {
  const branding = useWorkspaceBranding();
  const router = useRouter();
  const initialAvatar = profileAvatarById(profile.avatarPresetId ?? "") ?? profileAvatarBySrc(profile.profileImageUrl);
  const [avatarChoice, setAvatarChoice] = useState<string | null>(initialAvatar?.id ?? null);
  const [savedAvatarId, setSavedAvatarId] = useState<string | null>(initialAvatar?.id ?? null);
  const hasPhoto = profile.hasProfilePhoto === true;
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);

  function publishImage(photoUrl: string) {
    announceProfilePhoto(photoUrl);
    router.refresh();
  }

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
      publishImage(nextAvatarUrl);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "No se pudo guardar el avatar.",
      );
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  async function restorePhoto() {
    if (savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/portal/profile-photo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "PHOTO" }),
      });
      const body = await readAvatarResponse(response);
      const photoUrl = body.photoUrl ?? body.url;
      if (!response.ok || body.success === false || !photoUrl) throw new Error(body.error ?? "No se pudo restaurar la foto.");
      setAvatarChoice(null);
      setSavedAvatarId(null);
      setMessage(body.message ?? "Foto propia restaurada.");
      publishImage(photoUrl);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo restaurar la foto.");
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  return (
    <div className={`${styles.page} mx-auto w-full max-w-3xl space-y-4 overflow-x-clip`}>
      <Link
        href="/portal/perfil"
        className={`${styles.back} inline-flex items-center gap-2 rounded-xl border text-sm font-bold transition hover:text-[var(--brand-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bm-accent)]`}
      >
        <span aria-hidden="true">←</span> Volver
      </Link>

      <header>
        <p className="text-[10px] font-black uppercase tracking-[.2em] text-[var(--brand-text)]">
          {branding.displayName}
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-[var(--foreground)]">
          Elegí tu avatar
        </h1>
      </header>

      {error && <p role="alert" className="rounded-xl bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] p-3 text-sm text-[var(--danger)]">{error}</p>}
      {message && <p role="status" className="rounded-xl bg-[color-mix(in_srgb,var(--success)_10%,transparent)] p-3 text-sm text-[var(--success)]">{message}</p>}

      <section aria-labelledby="avatar-gallery-title">
          <h2 id="avatar-gallery-title" className="text-[10px] font-black uppercase tracking-[.18em] text-[var(--brand-text)]">Avatares BM</h2>
          <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-5" role="group" aria-label="Avatares disponibles">
            {PROFILE_AVATARS.map((avatar) => {
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
                  className={`${styles.choice} min-w-0 rounded-2xl border p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bm-accent)]`}
                >
                  <img src={avatar.src} alt="" loading="lazy" decoding="async" className="mx-auto aspect-square w-full rounded-full object-cover" />
                  {selected && <span className={styles.check} aria-hidden="true"><BmCheckIcon size={12} /></span>}
                  <span className="mt-2 block truncate text-[10px] font-semibold text-[var(--foreground)] sm:text-xs">
                    {avatar.label}
                  </span>
                </button>
              );
            })}
          </div>
      </section>

      {avatarChoice && avatarChoice !== savedAvatarId && <div className={styles.avatarSaveDock}>
      <button
        type="button"
        onClick={saveAvatar}
        disabled={saving || !avatarChoice || avatarChoice === savedAvatarId}
        className="min-h-12 w-full rounded-xl bg-[var(--bm-accent)] px-4 font-black text-[var(--bm-accent-contrast)] transition hover:bg-[var(--bm-accent-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bm-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar avatar"}
      </button>
      </div>}

      {hasPhoto && savedAvatarId && <button type="button" disabled={saving} onClick={restorePhoto} className="min-h-11 rounded-xl border border-[var(--border-soft)] px-4 text-sm font-semibold text-[var(--foreground)] transition hover:border-[var(--bm-accent)] disabled:opacity-50">Volver a mi foto anterior</button>}

    </div>
  );
}
