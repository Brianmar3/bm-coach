"use client";
/* eslint-disable @next/next/no-img-element -- profile photos are validated Blob URLs or bundled avatars */

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const [pendingAvatar, setPendingAvatar] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const initials = `${profile.firstName[0] ?? ""}${profile.lastName[0] ?? ""}`.toUpperCase();

  useEffect(() => () => {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
  }, [preview]);

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
      setPendingAvatar("");
      setPreview(URL.createObjectURL(compressed));
    } catch {
      setError("No pudimos preparar esa imagen. Probá con otra foto.");
    }
  }

  function chooseAvatar(id: string, src: string) {
    if (preview.startsWith("blob:")) URL.revokeObjectURL(preview);
    setPendingFile(null);
    setPendingAvatar(id);
    setPreview(src);
    setError("");
    setMessage("");
  }

  async function save() {
    if (!pendingFile && !pendingAvatar) return;
    setSaving(true);
    setError("");
    try {
      const response = pendingAvatar
        ? await fetch("/api/portal/profile-photo", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ avatarId: pendingAvatar }),
          })
        : await fetch("/api/portal/profile-photo", {
            method: "POST",
            body: (() => {
              const form = new FormData();
              form.set("photo", pendingFile as File);
              return form;
            })(),
          });
      const body = await response.json() as { url?: string; message?: string; error?: string };
      if (!response.ok || !body.url) throw new Error(body.error ?? "No se pudo guardar la imagen.");
      setPhoto(body.url);
      setPreview("");
      setPendingFile(null);
      setPendingAvatar("");
      if (input.current) input.current.value = "";
      setMessage(body.message ?? "Imagen actualizada correctamente.");
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la imagen.");
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
      setPendingAvatar("");
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
        <div className="mt-3 grid grid-cols-4 gap-2" role="group" aria-label="Avatares de BM Training">
          {PROFILE_AVATARS.map((avatar) => <button key={avatar.id} type="button" disabled={saving} onClick={() => chooseAvatar(avatar.id, avatar.src)} aria-label={`Elegir avatar ${avatar.label}`} aria-pressed={pendingAvatar === avatar.id} className={`mx-auto grid aspect-square w-full max-w-16 place-items-center overflow-hidden rounded-full border-2 bg-black p-0.5 transition focus:outline-none focus:ring-2 focus:ring-yellow-300 ${pendingAvatar === avatar.id ? "border-yellow-300" : "border-zinc-700 hover:border-yellow-400/50"}`}><img src={avatar.src} alt="" className="h-full w-full rounded-full object-cover" /></button>)}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => choose(event.target.files?.[0])} className="sr-only" />
          <button type="button" disabled={saving} onClick={() => input.current?.click()} className="min-h-11 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-yellow-300">Subir desde galería</button>
          {preview && <button type="button" disabled={saving} onClick={save} className="min-h-11 rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-black">{saving ? "Guardando…" : pendingAvatar ? "Guardar avatar" : "Guardar foto"}</button>}
          {(photo || preview) && <button type="button" disabled={saving} onClick={remove} className="min-h-11 rounded-lg px-3 py-2 text-sm text-red-300">Eliminar imagen</button>}
        </div>
        {preview && <p className="mt-2 text-xs text-yellow-200">Vista previa lista. Confirmá para guardar el cambio.</p>}
        {error && <p role="alert" className="mt-3 rounded-lg bg-red-400/10 p-2 text-sm text-red-300">{error}</p>}
        {message && <p role="status" className="mt-3 rounded-lg bg-emerald-400/10 p-2 text-sm text-emerald-300">{message}</p>}
      </div>
    </header>
    <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <h2 className="font-semibold">Información personal y deportiva</h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2"><Item title="Teléfono" value={profile.phone} /><Item title="Correo" value={profile.email || "Sin correo"} /><Item title="Fecha de nacimiento" value={showDate(profile.birthDate)} /><Item title="Objetivo" value={profile.goal || "No definido"} /><Item title="Plan" value={profile.plan} /><Item title="Fecha de ingreso" value={showDate(profile.joinedAt)} /><Item title="Estado" value={profile.status} /></dl>
      <p className="mt-5 text-xs text-zinc-500">Para modificar estos datos, contactá a tu entrenador.</p>
    </section>
    <Link href="/portal/registro" className="mt-4 flex min-h-12 items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"><span><strong className="block text-yellow-300">Mis registros</strong><span className="text-xs text-zinc-500">Notas, fotos y progresos personales</span></span><span className="text-yellow-400">›</span></Link>
    <Link href="/portal/pagos" className="mt-3 flex min-h-12 items-center justify-between rounded-xl border border-yellow-400/20 bg-yellow-400/5 px-4 py-3"><span><strong className="block text-yellow-300">Mi cuota</strong><span className="text-xs text-zinc-500">Estado e historial de pagos</span></span><span>›</span></Link>
    <Link href="/portal/configuracion" className="mt-3 flex min-h-12 items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3"><span><strong className="block">Configuración</strong><span className="text-xs text-zinc-500">Cuenta, seguridad y notificaciones</span></span><span className="text-yellow-400">›</span></Link>
  </div>;
}

function Item({ title, value }: { title: string; value: string }) {
  return <div><dt className="text-xs text-zinc-500">{title}</dt><dd className="mt-1 capitalize">{value || "Sin definir"}</dd></div>;
}
