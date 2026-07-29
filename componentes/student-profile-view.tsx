"use client";
/* eslint-disable @next/next/no-img-element -- profile photos are validated Blob URLs or bundled avatars */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { studentServiceLabel } from "@/lib/student-service";
import { useEffect, useRef, useState } from "react";
import { PROFILE_AVATARS } from "@/lib/profile-avatars";
import type { PortalProfile } from "@/types/portal";

const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
const showDate = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR") : "Sin definir";

async function compressProfilePhoto(file: File) {
  const source = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("No se pudo leer la imagen."));
      element.src = source;
    });
    const maxSide = 1200;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    if (scale === 1 && file.size < 900 * 1024) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.86));
    return blob ? new File([blob], "perfil.webp", { type: "image/webp" }) : file;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export function StudentProfileView({ profile }: { profile: PortalProfile }) {
  const router = useRouter();
  const [photo, setPhoto] = useState(profile.profileImageUrl);
  const [preview, setPreview] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [avatarChoice, setAvatarChoice] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const avatarButton = useRef<HTMLButtonElement>(null);
  const initials = `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();

  useEffect(() => () => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);
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

  async function choose(file?: File) {
    setError("");
    setMessage("");
    if (!file) return;
    if (file.size > MAX_PHOTO_BYTES || !ALLOWED_PHOTO_TYPES.includes(file.type)) {
      setError("Elegí una foto JPG, PNG o WEBP de hasta 3 MB.");
      return;
    }
    try {
      const compressed = await compressProfilePhoto(file);
      if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
      setPendingFile(compressed);
      setPreview(URL.createObjectURL(compressed));
    } catch {
      setError("No pudimos preparar esa imagen. Probá con otra foto.");
    }
  }

  function openAvatarPicker() {
    setAvatarChoice(PROFILE_AVATARS.find((avatar) => avatar.src === photo)?.id ?? "");
    setAvatarPickerOpen(true);
  }

  function closeAvatarPicker() {
    setAvatarPickerOpen(false);
    window.setTimeout(() => avatarButton.current?.focus(), 0);
  }

  async function savePhoto() {
    if (!pendingFile) return;
    setSaving(true);
    setError("");
    try {
      const form = new FormData();
      form.set("photo", pendingFile);
      const response = await fetch("/api/portal/profile-photo", { method: "POST", body: form });
      const body = await response.json() as { url?: string; message?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? "No se pudo guardar la imagen.");
      setPhoto(body.url);
      setPreview("");
      setPendingFile(null);
      if (input.current) input.current.value = "";
      setMessage(body.message ?? "Imagen actualizada correctamente.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la imagen.");
    } finally {
      setSaving(false);
    }
  }

  async function saveAvatar() {
    if (!avatarChoice) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/portal/profile-photo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarId: avatarChoice }),
      });
      const body = await response.json() as { url?: string; message?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? "No se pudo guardar el avatar.");
      setPhoto(body.url);
      setPreview("");
      setPendingFile(null);
      setAvatarPickerOpen(false);
      setMessage(body.message ?? "Avatar actualizado correctamente.");
      router.refresh();
      window.setTimeout(() => avatarButton.current?.focus(), 0);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el avatar.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("¿Eliminar tu foto o avatar de perfil y volver a mostrar tus iniciales?")) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/portal/profile-photo", { method: "DELETE" });
      const body = await response.json() as { message?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "No se pudo eliminar la imagen.");
      setPhoto("");
      setPreview("");
      setPendingFile(null);
      setAvatarChoice("");
      setMessage(body.message ?? "Imagen eliminada correctamente.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo eliminar la imagen.");
    } finally {
      setSaving(false);
    }
  }

  const shown = preview || photo;
  return <div>
    <header className="rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-zinc-900 to-[#0b0b0b] p-4 shadow-[0_14px_34px_rgba(0,0,0,.24)] sm:p-5">
      <div className="flex items-center gap-4">
        <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-full border border-yellow-400/30 bg-black shadow-[0_0_20px_rgba(250,204,21,.08)]">
          {shown ? <img src={shown} alt={`Foto de ${profile.firstName} ${profile.lastName}`} className="h-full w-full object-cover" /> : <span className="text-xl font-bold text-yellow-300">{initials || "BM"}</span>}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold">{profile.firstName} {profile.lastName}</h1>
          <p className="mt-1 text-sm text-zinc-400">{profile.plan || "Plan sin definir"}</p>
          <p className="mt-1 text-xs capitalize text-emerald-300">Alumno {profile.status}</p>
        </div>
      </div>
      <div className="mt-5 border-t border-zinc-800 pt-4">
        <h2 className="text-sm font-bold">Cambiar foto de perfil</h2>
        <p className="mt-1 text-xs text-zinc-500">Subí una foto o elegí un avatar de BM Training.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choose(event.target.files?.[0])} className="sr-only" />
          <button type="button" disabled={saving} onClick={() => input.current?.click()} className="min-h-11 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-yellow-300">Subir desde galería</button>
          <button ref={avatarButton} type="button" disabled={saving} onClick={openAvatarPicker} className="min-h-11 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-yellow-300">Elegir avatar</button>
          {preview && <button type="button" disabled={saving} onClick={savePhoto} className="min-h-11 rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-black">{saving ? "Guardando…" : "Guardar foto"}</button>}
          {photo && <button type="button" disabled={saving} onClick={remove} className="min-h-11 rounded-lg px-3 py-2 text-sm text-red-300">Quitar foto</button>}
        </div>
        {preview && <p className="mt-2 text-xs text-yellow-200">Vista previa lista. Confirmá para guardar el cambio.</p>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-400/10 p-2 text-sm text-red-300">{error}</p>}
        {message && <p role="status" className="mt-3 rounded-lg bg-emerald-400/10 p-2 text-sm text-emerald-300">{message}</p>}
      </div>
    </header>
    <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="font-semibold">Información personal y deportiva</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2"><Item title="Teléfono" value={profile.phone} /><Item title="Correo" value={profile.email || "Sin correo"} /><Item title="Fecha de nacimiento" value={showDate(profile.birthDate)} /><Item title="Objetivo" value={profile.goal || "No definido"} /><Item title="Tipo de servicio" value={studentServiceLabel(profile.serviceType)} /><Item title="Plan" value={profile.plan} /><Item title="Fecha de ingreso" value={showDate(profile.joinedAt)} /><Item title="Estado" value={profile.status} /></dl>
      <p className="mt-5 text-xs text-zinc-500">Para modificar estos datos, contactá a tu entrenador.</p>
    </section>
    <Link href="/portal/registro" className="mt-4 flex min-h-14 items-center justify-between rounded-2xl border border-yellow-400/15 bg-gradient-to-r from-zinc-900 to-[#0d0d0d] px-4 py-3 shadow-[0_10px_28px_rgba(0,0,0,.2)] transition hover:border-yellow-400/30 focus:outline-none focus:ring-2 focus:ring-yellow-300"><span><strong className="block text-yellow-300">Mis registros</strong><span className="mt-0.5 block text-xs text-zinc-500">Consultá las notas y archivos que guardaste.</span></span><span className="ml-3 text-yellow-400">›</span></Link>
    <Link href="/portal/pagos" className="mt-3 flex min-h-12 items-center justify-between rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3"><span><strong className="block text-yellow-300">Mi cuota</strong><span className="text-xs text-zinc-500">Estado e historial de pagos</span></span><span>›</span></Link>
    <Link href="/portal/configuracion" className="mt-3 flex min-h-12 items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"><span><strong className="block">Configuración</strong><span className="text-xs text-zinc-500">Cuenta, seguridad y notificaciones</span></span><span className="text-yellow-400">›</span></Link>
    {avatarPickerOpen && <div className="fixed inset-0 z-[70] flex items-end bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-5" onMouseDown={(event) => event.target === event.currentTarget && closeAvatarPicker()}><section role="dialog" aria-modal="true" aria-labelledby="avatar-picker-title" className="max-h-[calc(100dvh-1rem)] w-full overflow-y-auto rounded-t-3xl border border-yellow-400/15 bg-[#111] p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-[0_-18px_50px_rgba(0,0,0,.55)] sm:mx-auto sm:max-w-lg sm:rounded-3xl sm:p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-yellow-400">BM Training</p><h2 id="avatar-picker-title" className="mt-1 text-xl font-bold">Elegí tu avatar</h2><p className="mt-1 text-sm text-zinc-500">Seleccioná una ilustración y confirmá el cambio.</p></div><button type="button" onClick={closeAvatarPicker} disabled={saving} aria-label="Cerrar selector de avatares" className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-zinc-700 text-zinc-400 focus:outline-none focus:ring-2 focus:ring-yellow-300">×</button></div><div className="mt-5 grid grid-cols-3 gap-3 sm:grid-cols-4" role="group" aria-label="Avatares deportivos">{PROFILE_AVATARS.map((avatar) => { const selected = avatarChoice === avatar.id; return <button key={avatar.id} type="button" disabled={saving} onClick={() => setAvatarChoice(avatar.id)} aria-label={`Elegir avatar ${avatar.label}`} aria-pressed={selected} className={`min-w-0 rounded-2xl border p-2 transition focus:outline-none focus:ring-2 focus:ring-yellow-300 ${selected ? "border-yellow-300 bg-yellow-400/10" : "border-zinc-800 bg-black hover:border-yellow-400/35"}`}><img src={avatar.src} alt="" className="mx-auto aspect-square w-full rounded-full object-cover" /><span className="mt-2 block truncate text-[10px] font-semibold text-zinc-300">{avatar.label}</span></button>; })}</div><div className="mt-5 grid grid-cols-2 gap-3"><button type="button" onClick={closeAvatarPicker} disabled={saving} className="min-h-12 rounded-xl border border-zinc-700 px-4 font-bold text-zinc-300">Cancelar</button><button type="button" onClick={saveAvatar} disabled={saving || !avatarChoice} className="min-h-12 rounded-xl bg-yellow-400 px-4 font-black text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : "Guardar avatar"}</button></div></section></div>}
  </div>;
}

function Item({ title, value }: { title: string; value: string }) {
  return <div><dt className="text-xs text-zinc-500">{title}</dt><dd className="mt-1 capitalize">{value || "Sin definir"}</dd></div>;
}
