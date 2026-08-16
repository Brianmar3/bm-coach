"use client";

import { FormEvent, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/componentes/password-field";
import { safeInternalPath } from "@/lib/client-api";

export default function AdminLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const tokenRef = useRef<HTMLInputElement>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (!token.trim() || token.trim().length < 32) {
      setFieldError(token.trim() ? "Revisá que la credencial esté completa." : "Ingresá tu credencial administrativa.");
      tokenRef.current?.focus();
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      await response.json();
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) setFieldError("La credencial ingresada no es correcta.");
        throw new Error("No pudimos iniciar sesión. Revisá la credencial e intentá nuevamente.");
      }
      setToken("");
      const next = safeInternalPath(new URLSearchParams(window.location.search).get("next"), "/dashboard");
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
      <Image src="/bm-training-logo.png" alt="BM Training — Gestión, entrenamiento y seguimiento" width={300} height={200} priority sizes="(max-width: 480px) 240px, 300px" className="mx-auto h-auto w-full max-w-[260px] object-contain" />
      <p className="mt-2 text-center text-xs font-bold uppercase tracking-[.25em] text-yellow-400">Panel administrativo</p>
      <h1 className="mt-3 text-center text-3xl font-black">Acceso del entrenador</h1>
      <p className="mt-2 text-sm text-zinc-400">Ingresá la credencial administrativa para abrir una sesión segura.</p>
      <div className="mt-6"><PasswordField ref={tokenRef} id="admin-credential" label="Credencial administrativa" required minLength={32} autoComplete="current-password" value={token} error={fieldError} onChange={(event) => { setToken(event.target.value); setError(""); if (fieldError) setFieldError(""); }} className="bg-black" /></div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={loading} aria-busy={loading} className="mt-6 w-full rounded-xl bg-yellow-400 px-4 py-3 font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">{loading ? "Ingresando…" : "Ingresar"}</button>
    </form>
  </main>;
}
