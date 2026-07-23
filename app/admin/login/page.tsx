"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "No se pudo iniciar sesión.");
      setToken("");
      const destination = new URLSearchParams(window.location.search).get("next");
      router.replace(destination?.startsWith("/") && !destination.startsWith("//") ? destination : "/");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-zinc-950 p-5 text-white">
    <form onSubmit={submit} className="w-full max-w-md rounded-3xl border border-yellow-400/20 bg-zinc-900 p-7 shadow-2xl shadow-black">
      <p className="text-xs font-bold uppercase tracking-[.25em] text-yellow-400">BM Coach</p>
      <h1 className="mt-3 text-3xl font-black">Acceso del entrenador</h1>
      <p className="mt-2 text-sm text-zinc-400">Ingresá la credencial administrativa para abrir una sesión segura.</p>
      <label className="mt-6 block text-sm font-semibold">Credencial administrativa
        <input type="password" autoComplete="current-password" required minLength={32} value={token} onChange={(event) => setToken(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-700 bg-black px-4 py-3 outline-none focus:border-yellow-400" />
      </label>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      <button disabled={loading} className="mt-6 w-full rounded-xl bg-yellow-400 px-4 py-3 font-black text-zinc-950 disabled:opacity-60">{loading ? "Ingresando…" : "Ingresar"}</button>
    </form>
  </main>;
}
