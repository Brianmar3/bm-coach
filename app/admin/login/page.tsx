"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/componentes/password-field";
import { safeInternalPath } from "@/lib/client-api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) { setFieldError("Ingresá tu email y contraseña."); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const result = await response.json() as { next?: string };
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setFieldError("La credencial ingresada no es correcta.");
        throw new Error("No pudimos iniciar sesión. Revisá la credencial e intentá nuevamente.");
      }
      setPassword("");
      const next = result.next === "/trainer/onboarding" ? result.next : safeInternalPath(new URLSearchParams(window.location.search).get("next"), "/dashboard");
      router.replace(next);
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-zinc-950 p-5 text-white">
    <form noValidate onSubmit={submit} className="w-full max-w-md rounded-3xl border border-yellow-400/20 bg-zinc-900 p-7 shadow-2xl shadow-black">
      <Image src="/bm-training-logo.png" alt="BM Training — Gestión, entrenamiento y seguimiento" width={526} height={430} priority unoptimized sizes="(max-width: 480px) 200px, 250px" className="mx-auto h-auto w-full max-w-[215px] object-contain" />
      <p className="mt-2 text-center text-xs font-bold uppercase tracking-[.25em] text-yellow-400">Panel del entrenador</p>
      <h1 className="mt-3 text-center text-3xl font-black">Acceso del entrenador</h1>
      <p className="mt-2 text-sm text-zinc-400">Ingresá con tu cuenta de entrenador para abrir una sesión segura.</p>
      <div className="mt-6 space-y-4"><label htmlFor="trainer-email" className="block text-sm font-medium text-zinc-200">Email<input id="trainer-email" type="email" required autoComplete="username" value={email} onChange={(event) => { setEmail(event.target.value); setFieldError(""); }} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-black px-3 text-white outline-none focus:border-yellow-400"/></label><PasswordField id="trainer-password" label="Contraseña" required autoComplete="current-password" value={password} error={fieldError} onChange={(event) => { setPassword(event.target.value); setError(""); if (fieldError) setFieldError(""); }} className="bg-black" /></div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={loading} aria-busy={loading} className="mt-6 w-full rounded-xl bg-yellow-400 px-4 py-3 font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">{loading ? "Ingresando…" : "Ingresar"}</button>
      <div className="mt-4 border-t border-zinc-800 pt-3 text-center">
        <p className="text-xs text-zinc-500">¿Sos alumno?</p>
        <Link href="/portal/login" className="mt-0.5 inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold text-yellow-400 transition hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
          Entrar al portal
        </Link>
      </div>
    </form>
  </main>;
}
