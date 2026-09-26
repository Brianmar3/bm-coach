"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { WorkspaceBrandLogo } from "@/componentes/workspace-brand-logo";
import { workspaceBrandingVariables, type WorkspaceBranding } from "@/lib/workspace-branding";

const field = "mt-1 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-base text-white outline-none focus:border-yellow-400";

export function StudentInvitationForm({ token, branding }: { token: string; branding: Pick<WorkspaceBranding, "accentColor" | "logoMode" | "displayName"> }) {
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);
  const [loginUrl, setLoginUrl] = useState("/portal/login?mode=student");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return; setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    const body = Object.fromEntries(["firstName", "lastName", "phone", "birthDate", "username", "password", "confirmPassword"].map((key) => [key, String(form.get(key) ?? "")]));
    try {
      const response = await fetch(`/api/student-invitations/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string; loginUrl?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo crear la cuenta.");
      if (result.loginUrl === "/portal/login?mode=student") setLoginUrl(result.loginUrl);
      setDone(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo crear la cuenta."); }
    finally { setSaving(false); }
  }
  return <main className="workspace-brand min-h-[100dvh] overflow-x-hidden bg-black px-4 py-8 text-white" style={workspaceBrandingVariables(branding.accentColor) as React.CSSProperties}><div className="mx-auto w-full max-w-md">
    <header className="mb-5 flex items-center gap-3">{branding.logoMode === "CUSTOM" && !logoFailed ? <Image unoptimized src={`/api/student-invitations/${token}/logo`} alt={`Logo de ${branding.displayName}`} width={44} height={44} className="h-11 w-11 object-contain" onError={() => setLogoFailed(true)} /> : <WorkspaceBrandLogo branding={{ ...branding, logoMode: logoFailed ? "DEFAULT" : branding.logoMode, customLogoUrl: "" }} className="h-11 w-11" />}<span className="text-lg font-black">{branding.displayName}</span></header>
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 shadow-xl sm:p-7">{done ? <><h1 className="text-2xl font-black">Tu cuenta fue creada</h1><p className="mt-3 text-sm text-zinc-400">Ingresá con el usuario y la contraseña que acabás de elegir.</p><Link href={loginUrl} className="mt-6 block rounded-xl bg-yellow-400 px-4 py-3 text-center font-black text-zinc-950">Ingresar como alumno</Link></> : <><h1 className="text-2xl font-black">Completá tu registro</h1><p className="mt-2 text-sm text-zinc-400">Tu entrenador te invitó a {branding.displayName}.</p><form onSubmit={submit} className="mt-5 space-y-4">{error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Nombre<input name="firstName" required maxLength={80} autoComplete="given-name" className={field} /></label><label className="text-sm">Apellido<input name="lastName" required maxLength={80} autoComplete="family-name" className={field} /></label></div><label className="block text-sm">Teléfono<input name="phone" required type="tel" inputMode="tel" maxLength={40} autoComplete="tel" className={field} /></label><label className="block text-sm">Fecha de nacimiento <span className="text-zinc-500">(opcional)</span><input name="birthDate" type="date" className={field} /></label><label className="block text-sm">Nombre de usuario<input name="username" required minLength={3} maxLength={80} autoCapitalize="none" autoComplete="username" className={field} /></label><label className="block text-sm">Contraseña<input name="password" required type={showPassword ? "text" : "password"} minLength={10} maxLength={128} autoComplete="new-password" className={field} /></label><button type="button" onClick={() => setShowPassword((value) => !value)} className="text-sm text-yellow-300">{showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}</button><label className="block text-sm">Confirmar contraseña<input name="confirmPassword" required type={showPassword ? "text" : "password"} minLength={10} maxLength={128} autoComplete="new-password" className={field} /></label><button disabled={saving} className="min-h-12 w-full rounded-xl bg-yellow-400 px-4 font-black text-zinc-950 disabled:opacity-60">{saving ? "Creando cuenta…" : "Crear mi cuenta"}</button></form><Link href="/portal/login?mode=student" className="mt-4 flex min-h-11 items-center justify-center text-sm font-semibold text-yellow-300">Ingresar como alumno</Link></>}</section>
    <p className="mt-5 text-center text-xs text-zinc-600">Powered by BM Training</p>
  </div></main>;
}
