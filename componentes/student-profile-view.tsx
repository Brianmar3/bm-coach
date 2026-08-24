"use client";

/* eslint-disable @next/next/no-img-element -- avatars may be persisted uploads or bundled assets */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatars";
import { studentServiceLabel } from "@/lib/student-service";
import type { PortalProfile } from "@/types/portal";
import { PushNotificationsCard } from "@/componentes/push-notifications-card";

const showDate = (value: string) => value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR") : "Sin definir";
const icon: Record<string, string> = { phone: "☎", email: "✉", birth: "▣", goal: "◎", service: "◫", plan: "▤", joined: "↪", status: "◇" };

export function StudentProfileView({ profile: initialProfile }: { profile: PortalProfile }) {
  const [profile, setProfile] = useState(initialProfile);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ phone: profile.phone, email: profile.email, birthDate: profile.birthDate, goal: profile.goal });
  const settingsRef = useRef<HTMLDivElement>(null);
  const shown = profile.profileImageUrl || DEFAULT_PROFILE_AVATAR.src;
  const active = profile.status.toLocaleLowerCase("es").includes("activo") && !profile.status.toLocaleLowerCase("es").includes("inactivo");

  useEffect(() => {
    if (!settingsOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSettingsOpen(false); };
    const outside = (event: PointerEvent) => { if (!settingsRef.current?.contains(event.target as Node)) setSettingsOpen(false); };
    document.addEventListener("keydown", close);
    document.addEventListener("pointerdown", outside);
    return () => { document.removeEventListener("keydown", close); document.removeEventListener("pointerdown", outside); };
  }, [settingsOpen]);

  async function save() {
    setSaving(true); setMessage("");
    try {
      const response = await fetch("/api/portal/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const body = await response.json() as { profile?: Pick<PortalProfile, "phone" | "email" | "birthDate" | "goal">; error?: string };
      if (!response.ok || !body.profile) throw new Error(body.error || "No se pudieron guardar los cambios.");
      setProfile((value) => ({ ...value, ...body.profile }));
      setEditing(false); setMessage("Datos actualizados.");
      window.dispatchEvent(new Event("bm:portal-data-refresh"));
    } catch (error) { setMessage(error instanceof Error ? error.message : "No se pudieron guardar los cambios."); }
    finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-4xl space-y-4 pb-3">
    <section className="relative rounded-[28px] border border-yellow-400/25 bg-[radial-gradient(circle_at_12%_12%,rgba(250,204,21,.08),transparent_30%),linear-gradient(145deg,#151515,#090909)] p-5 shadow-[0_18px_44px_rgba(0,0,0,.34)] sm:p-7">
      <div className="flex items-center gap-4 sm:gap-7">
        <div className="size-28 shrink-0 overflow-hidden rounded-full border border-yellow-300/65 bg-black shadow-[0_0_28px_rgba(250,204,21,.14)] sm:size-40"><img src={shown} alt={`Avatar de ${profile.firstName} ${profile.lastName}`} className="h-full w-full object-cover" /></div>
        <div className="min-w-0 flex-1"><h1 className="text-2xl font-black leading-tight sm:text-4xl">{profile.firstName} {profile.lastName}</h1><p className="mt-3 text-sm text-zinc-400 sm:text-base"><span className="mr-2 text-yellow-400">▣</span>{profile.plan || "Plan sin definir"}</p><p className={`mt-2 text-sm sm:text-base ${active ? "text-emerald-300" : "text-zinc-400"}`}><span className={`mr-2 inline-block size-2.5 rounded-full ${active ? "bg-emerald-400" : "bg-zinc-500"}`} />Alumno {profile.status}</p></div>
        <div ref={settingsRef} className="relative self-start">
          <button type="button" aria-label="Abrir ajustes" aria-expanded={settingsOpen} onClick={() => setSettingsOpen((value) => !value)} className="grid size-12 place-items-center rounded-2xl border border-yellow-400/45 bg-black/35 text-2xl text-zinc-100 transition hover:bg-yellow-400/[.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 sm:size-16">⚙</button>
          {settingsOpen && <SettingsMenu onClose={() => setSettingsOpen(false)} />}
        </div>
      </div>
      <div className="mt-6 border-t border-white/10 pt-5"><h2 className="font-semibold">Elegir avatar</h2><p className="mt-1 text-sm text-zinc-500">Elegí el avatar que más te represente.</p><Link href="/portal/perfil/avatar" className="mt-4 inline-flex min-h-12 items-center gap-2 rounded-xl border border-yellow-400/65 px-4 font-bold text-yellow-300 transition hover:bg-yellow-400/[.06]"><span aria-hidden="true">♙+</span>Cambiar avatar</Link></div>
    </section>

    <section className="rounded-[26px] border border-yellow-400/20 bg-[linear-gradient(145deg,#151515,#0a0a0a)] p-4 shadow-[0_15px_35px_rgba(0,0,0,.28)] sm:p-6">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">Información personal y deportiva</h2><button type="button" onClick={() => { setEditing((value) => !value); setMessage(""); }} className="min-h-11 px-2 text-sm font-bold text-yellow-300">{editing ? "Cancelar" : "✎ Editar"}</button></div>
      {editing ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><EditField label="Teléfono" value={form.phone} onChange={(phone) => setForm({ ...form, phone })} /><EditField label="Correo" type="email" value={form.email} onChange={(email) => setForm({ ...form, email })} /><EditField label="Fecha de nacimiento" type="date" value={form.birthDate} onChange={(birthDate) => setForm({ ...form, birthDate })} /><EditField label="Objetivo" value={form.goal} onChange={(goal) => setForm({ ...form, goal })} /><button disabled={saving} onClick={save} className="min-h-12 rounded-xl bg-yellow-400 px-4 font-bold text-black disabled:opacity-60 sm:col-span-2">{saving ? "Guardando…" : "Guardar cambios"}</button></div> : <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/20"><InfoRow symbol={icon.phone} title="Teléfono" value={profile.phone || "Sin definir"} /><InfoRow symbol={icon.email} title="Correo" value={profile.email || "Sin correo"} /><InfoRow symbol={icon.birth} title="Fecha de nacimiento" value={showDate(profile.birthDate)} /><InfoRow symbol={icon.goal} title="Objetivo" value={profile.goal || "No definido"} /><InfoRow symbol={icon.service} title="Tipo de servicio" value={studentServiceLabel(profile.serviceType)} /><InfoRow symbol={icon.plan} title="Plan" value={profile.plan || "Sin definir"} /><InfoRow symbol={icon.joined} title="Fecha de ingreso" value={showDate(profile.joinedAt)} /><InfoRow symbol={icon.status} title="Estado" value={profile.status} last tone={active ? "success" : "default"} /></div>}
      {message && <p role="status" className={`mt-3 text-sm ${message === "Datos actualizados." ? "text-emerald-300" : "text-red-300"}`}>{message}</p>}
    </section>
  </div>;
}

function SettingsMenu({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  async function logout() { setBusy(true); try { await fetch("/api/portal/logout", { method: "POST" }); } finally { window.location.assign("/portal/login"); } }
  const links = [["Seguridad", "/portal/perfil/seguridad", "♧"], ["Privacidad", "/portal/perfil/privacidad", "▣"], ["Preferencias", "/portal/perfil/preferencias", "☷"], ["Ayuda", "/portal/perfil/ayuda", "?"]] as const;
  return <div role="dialog" aria-label="Ajustes de cuenta" className="fixed inset-x-4 top-[max(5.5rem,env(safe-area-inset-top))] z-[80] max-h-[calc(100dvh-7rem)] overflow-auto rounded-[24px] border border-yellow-400/55 bg-[#111] p-4 shadow-[0_24px_80px_rgba(0,0,0,.8),0_0_24px_rgba(250,204,21,.1)] sm:absolute sm:inset-auto sm:right-0 sm:top-[calc(100%+1rem)] sm:w-80">
    <div className="flex items-start justify-between"><div><h2 className="text-xl font-bold">Ajustes</h2><p className="text-sm text-zinc-500">Cuenta y ajustes</p></div><button type="button" onClick={onClose} aria-label="Cerrar ajustes" className="size-10 rounded-xl text-xl text-zinc-400">×</button></div>
    <div className="mt-4"><PushNotificationsCard compact /></div><nav className="mt-2 space-y-2">{links.map(([label, href, symbol]) => <Link key={label} href={href} onClick={onClose} className="flex min-h-14 items-center gap-3 rounded-xl border border-white/10 bg-white/[.025] px-4 transition hover:border-yellow-400/30"><span className="text-xl text-yellow-400">{symbol}</span><span className="flex-1 text-sm">{label}</span><span className="text-zinc-500">›</span></Link>)}</nav>
    <button disabled={busy} onClick={logout} className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-xl border border-red-400/30 px-4 text-left text-sm text-red-300"><span className="text-xl">↪</span>{busy ? "Cerrando…" : "Cerrar sesión"}</button>
  </div>;
}

function InfoRow({ symbol, title, value, last = false, tone = "default" }: { symbol: string; title: string; value: string; last?: boolean; tone?: "default" | "success" }) { return <div className={`grid min-h-14 grid-cols-[1.5rem_minmax(0,.8fr)_minmax(0,1fr)] items-center gap-3 px-4 py-3 ${last ? "" : "border-b border-white/10"}`}><span className="text-lg text-yellow-400">{symbol}</span><span className="text-sm text-zinc-500">{title}</span><span className={`break-words text-right text-sm capitalize ${tone === "success" ? "text-emerald-300" : "text-zinc-100"}`}>{value}</span></div>; }
function EditField({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) { return <label className="text-sm text-zinc-400">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-black px-3 py-3 text-white outline-none focus:border-yellow-400" /></label>; }
