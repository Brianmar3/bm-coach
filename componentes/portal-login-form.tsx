"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/componentes/password-field";
import { safeInternalPath } from "@/lib/client-api";

type LoginErrors = { username?: string; password?: string };

export function PortalLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<LoginErrors>({});
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    const nextErrors: LoginErrors = {};
    if (!username.trim()) nextErrors.username = "Ingresá tu usuario.";
    if (!password) nextErrors.password = "Ingresá tu contraseña.";
    if (Object.keys(nextErrors).length) {
      setFieldErrors(nextErrors);
      (nextErrors.username ? usernameRef : passwordRef).current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/portal/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) { setFieldErrors({ password: "Los datos ingresados no son correctos." }); passwordRef.current?.focus(); }
        throw new Error(response.status === 429 ? (body.error ?? "Esperá unos minutos antes de volver a intentar.") : "No pudimos iniciar sesión. Revisá los datos e intentá nuevamente.");
      }
      const next = safeInternalPath(new URLSearchParams(window.location.search).get("next"), "/portal");
      router.replace(next);
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }
  return <main className="grid min-h-[100dvh] place-items-center overflow-y-auto bg-black p-4 text-white">
    <section className="w-full max-w-md rounded-3xl border border-yellow-400/25 bg-zinc-900 p-5 shadow-2xl shadow-black sm:p-7">
      <div className="text-center">
        <Image src="/bm-training-logo.png" alt="BM Training — Gestión, entrenamiento y seguimiento" width={300} height={200} priority sizes="(max-width: 480px) 240px, 300px" className="mx-auto h-auto w-full max-w-[260px] object-contain" />
        <p className="mt-2 text-xs font-bold uppercase tracking-[.2em] text-yellow-400">Portal del alumno</p>
        <h1 className="mt-2 text-2xl font-bold">Ingresá a tu cuenta</h1>
        <p className="mt-2 text-sm text-zinc-500">Usá las credenciales entregadas por tu entrenador.</p>
      </div>
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      <form noValidate onSubmit={submit} className="mt-6 space-y-4">
        <label htmlFor="portal-username" className="block text-sm"><span className="font-semibold">Usuario</span><input ref={usernameRef} id="portal-username" required autoComplete="username" value={username} aria-invalid={fieldErrors.username ? true : undefined} aria-describedby={fieldErrors.username ? "portal-username-error" : undefined} onChange={(event) => { setUsername(event.target.value); setError(""); if (fieldErrors.username) setFieldErrors((current) => ({ ...current, username: undefined })); }} className={`mt-1 w-full rounded-xl border bg-zinc-950 px-4 py-3 text-base outline-none transition sm:text-sm ${fieldErrors.username ? "border-red-400 focus:border-red-400 focus:ring-2 focus:ring-red-400/25" : "border-zinc-700 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/15"}`} />{fieldErrors.username && <span id="portal-username-error" role="alert" className="mt-1.5 block text-xs text-red-300">{fieldErrors.username}</span>}</label>
        <PasswordField ref={passwordRef} id="portal-password" label="Contraseña" required autoComplete="current-password" value={password} error={fieldErrors.password} onChange={(event) => { setPassword(event.target.value); setError(""); if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined })); }} />
        <button type="submit" disabled={loading} aria-busy={loading} className="w-full rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 disabled:cursor-wait disabled:opacity-60">{loading ? "Ingresando…" : "Iniciar sesión"}</button>
      </form>
      <div className="mt-4 border-t border-zinc-800 pt-3 text-center">
        <p className="text-xs text-zinc-500">¿Sos entrenador?</p>
        <Link href="/admin/login?next=%2F" className="mt-0.5 inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-semibold text-yellow-400 transition hover:text-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900">
          Entrar al panel
        </Link>
      </div>
    </section>
  </main>;
}
