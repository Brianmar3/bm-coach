"use client";
/* eslint-disable @next/next/no-img-element -- profile image is a preserved Blob URL or a bundled avatar */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_PROFILE_AVATAR, PROFILE_AVATARS } from "@/lib/profile-avatars";
import { studentServiceLabel } from "@/lib/student-service";
import type { PortalProfile } from "@/types/portal";

const showDate = (value: string) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR")
    : "Sin definir";

type AvatarResponse = {
  success?: boolean;
  photoUrl?: string;
  url?: string;
  message?: string;
  error?: string;
};

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

export function StudentProfileView({ profile }: { profile: PortalProfile }) {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(profile.profileImageUrl);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarChoice, setAvatarChoice] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const avatarButton = useRef<HTMLButtonElement>(null);
  const savingLock = useRef(false);

  useEffect(() => {
    if (!avatarPickerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAvatarPicker();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [avatarPickerOpen]);

  function openAvatarPicker() {
    setError("");
    setMessage("");
    setAvatarChoice(
      PROFILE_AVATARS.find((avatar) => avatar.src === avatarUrl)?.id ??
        DEFAULT_PROFILE_AVATAR.id,
    );
    setAvatarPickerOpen(true);
  }

  function closeAvatarPicker() {
    setAvatarPickerOpen(false);
    window.setTimeout(() => avatarButton.current?.focus(), 0);
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
      setAvatarUrl(nextAvatarUrl);
      setAvatarPickerOpen(false);
      setMessage(body.message ?? "Avatar actualizado correctamente.");
      window.dispatchEvent(
        new CustomEvent("bm:profile-photo-updated", {
          detail: { photoUrl: nextAvatarUrl },
        }),
      );
      router.refresh();
      window.setTimeout(() => avatarButton.current?.focus(), 0);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo guardar el avatar.",
      );
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  }

  const shown = avatarUrl || DEFAULT_PROFILE_AVATAR.src;
  const selectedAvatar =
    PROFILE_AVATARS.find((avatar) => avatar.id === avatarChoice) ??
    DEFAULT_PROFILE_AVATAR;

  return (
    <div>
      <header className="rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-[#0b0b0b] p-4 shadow-[0_14px_34px_rgba(0,0,0,.24)] sm:p-5">
        <div className="flex items-center gap-4">
          <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-yellow-400/30 bg-black shadow-[0_0_20px_rgba(250,204,21,.08)]">
            <img
              src={shown}
              alt={`Avatar de ${profile.firstName} ${profile.lastName}`}
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold">
              {profile.firstName} {profile.lastName}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {profile.plan || "Plan sin definir"}
            </p>
            <p className="mt-1 text-xs capitalize text-emerald-300">
              Alumno {profile.status}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-zinc-800 pt-4">
          <h2 className="text-sm font-bold">Elegir avatar</h2>
          <p className="mt-1 text-xs text-zinc-500">
            Elegí el avatar que más te represente.
          </p>
          <button
            ref={avatarButton}
            type="button"
            disabled={saving}
            onClick={openAvatarPicker}
            className="mt-4 min-h-11 rounded-lg border border-yellow-400/25 bg-yellow-400/[.04] px-4 py-2 text-sm font-bold text-yellow-300 transition hover:border-yellow-400/45 focus:outline-none focus:ring-2 focus:ring-yellow-300"
          >
            Cambiar avatar
          </button>
          {error && (
            <p
              role="alert"
              className="mt-3 rounded-lg bg-red-400/10 p-2 text-sm text-red-300"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              role="status"
              className="mt-3 rounded-lg bg-emerald-400/10 p-2 text-sm text-emerald-300"
            >
              {message}
            </p>
          )}
        </div>
      </header>

      <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <h2 className="font-semibold">Información personal y deportiva</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <Item title="Teléfono" value={profile.phone} />
          <Item title="Correo" value={profile.email || "Sin correo"} />
          <Item title="Fecha de nacimiento" value={showDate(profile.birthDate)} />
          <Item title="Objetivo" value={profile.goal || "No definido"} />
          <Item
            title="Tipo de servicio"
            value={studentServiceLabel(profile.serviceType)}
          />
          <Item title="Plan" value={profile.plan} />
          <Item title="Fecha de ingreso" value={showDate(profile.joinedAt)} />
          <Item title="Estado" value={profile.status} />
        </dl>
        <p className="mt-5 text-xs text-zinc-500">
          Para modificar estos datos, contactá a tu entrenador.
        </p>
      </section>

      <Link
        href="/portal/registro"
        className="mt-4 flex min-h-14 items-center justify-between rounded-2xl border border-yellow-400/15 bg-gradient-to-r from-zinc-900 to-[#0d0d0d] px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,.2)] transition hover:border-yellow-400/30 focus:outline-none focus:ring-2 focus:ring-yellow-300"
      >
        <span>
          <strong className="block text-yellow-300">Mis registros</strong>
          <span className="mt-0.5 block text-xs text-zinc-500">
            Consultá las notas y archivos que guardaste.
          </span>
        </span>
        <span className="ml-3 text-yellow-400">›</span>
      </Link>
      <Link
        href="/portal/pagos"
        className="mt-3 flex min-h-12 items-center justify-between rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3"
      >
        <span>
          <strong className="block text-yellow-300">Mi cuota</strong>
          <span className="text-xs text-zinc-500">
            Estado e historial de pagos
          </span>
        </span>
        <span>›</span>
      </Link>
      <Link
        href="/portal/configuracion"
        className="mt-3 flex min-h-12 items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"
      >
        <span>
          <strong className="block">Configuración</strong>
          <span className="text-xs text-zinc-500">
            Cuenta, seguridad y notificaciones
          </span>
        </span>
        <span className="text-yellow-400">›</span>
      </Link>

      {avatarPickerOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-black/80 p-0 pt-[env(safe-area-inset-top)] backdrop-blur-sm sm:items-center sm:p-5"
          onMouseDown={(event) =>
            event.target === event.currentTarget && closeAvatarPicker()
          }
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="avatar-picker-title"
            className="flex max-h-[calc(100dvh-1rem)] w-full flex-col overflow-hidden rounded-t-3xl border border-yellow-400/15 bg-[#111] shadow-[0_-18px_50px_rgba(0,0,0,.55)] sm:mx-auto sm:max-w-2xl sm:rounded-3xl"
          >
            <div className="flex items-start justify-between gap-3 p-4 pb-3 sm:p-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">
                  BM Training
                </p>
                <h2 id="avatar-picker-title" className="mt-1 text-xl font-bold">
                  Elegí tu avatar
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Elegí el avatar que más te represente.
                </p>
              </div>
              <button
                type="button"
                onClick={closeAvatarPicker}
                disabled={saving}
                aria-label="Cerrar selector de avatares"
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-zinc-700 text-zinc-400 focus:outline-none focus:ring-2 focus:ring-yellow-300"
              >
                ×
              </button>
            </div>

            <div className="mx-4 flex items-center gap-3 rounded-2xl border border-yellow-400/15 bg-black/55 p-3 sm:mx-5">
              <img
                src={selectedAvatar.src}
                alt=""
                className="h-16 w-16 shrink-0 rounded-full border border-yellow-400/30 object-cover"
              />
              <div className="min-w-0">
                <p className="truncate font-bold text-yellow-200">
                  {selectedAvatar.label}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {selectedAvatar.category}
                </p>
              </div>
            </div>

            <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-4 sm:px-5">
              <div
                className="grid grid-cols-3 gap-2.5 sm:grid-cols-4"
                role="group"
                aria-label="Avatares deportivos"
              >
                {PROFILE_AVATARS.map((avatar) => {
                  const selected = avatarChoice === avatar.id;
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      disabled={saving}
                      onClick={() => setAvatarChoice(avatar.id)}
                      aria-label={`Elegir avatar ${avatar.label}`}
                      aria-pressed={selected}
                      className={`min-w-0 rounded-2xl border p-2 transition focus:outline-none focus:ring-2 focus:ring-yellow-300 ${
                        selected
                          ? "border-yellow-300 bg-yellow-400/10 shadow-[0_0_18px_rgba(250,204,21,.1)]"
                          : "border-zinc-800 bg-black hover:border-yellow-400/35"
                      }`}
                    >
                      <img
                        src={avatar.src}
                        alt=""
                        className="mx-auto aspect-square w-full rounded-full object-cover"
                      />
                      <span className="mt-2 block truncate text-[10px] font-semibold text-zinc-300">
                        {avatar.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-800 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:p-5">
              <button
                type="button"
                onClick={closeAvatarPicker}
                disabled={saving}
                className="min-h-12 rounded-xl border border-zinc-700 px-4 font-bold text-zinc-300"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveAvatar}
                disabled={saving || !avatarChoice}
                className="min-h-12 rounded-xl bg-yellow-400 px-4 font-black text-zinc-950 disabled:opacity-50"
              >
                {saving ? "Guardando…" : "Guardar avatar"}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Item({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-zinc-500">{title}</dt>
      <dd className="mt-1 capitalize">{value || "Sin definir"}</dd>
    </div>
  );
}
