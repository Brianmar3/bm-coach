"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/componentes/password-field";

export default function MasterLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    if (!email.trim() || !password) { setError("Ingresá tu email y contraseña."); return; }
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/platform/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) throw new Error("Los datos ingresados no son correctos.");
      setPassword("");
      router.replace("/platform/trainers");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  return <main className="grid min-h-screen place-items-center bg-zinc-950 p-5 text-white">
    <form noValidate onSubmit={submit} className="w-full max-w-md rounded-3xl border border-yellow-400/20 bg-zinc-900 p-7 shadow-2xl shadow-black">
      <Image src="/bm-training-logo.png" alt="BM Training" width={526} height={430} priority className="mx-auto h-auto w-full max-w-[230px] object-contain" />
      <p className="mt-3 text-center text-xs font-bold uppercase tracking-[.25em] text-yellow-400">Acceso reservado</p>
      <h1 className="mt-3 text-center text-3xl font-black">Gestión de plataforma</h1>
      <p className="mt-2 text-center text-sm text-zinc-400">Ingresá con la cuenta propietaria de la plataforma.</p>
      <div className="mt-6 space-y-4">
        <label htmlFor="master-email" className="block text-sm font-medium text-zinc-200">Email<input id="master-email" type="email" required autoComplete="username" value={email} onChange={(event) => { setEmail(event.target.value); setError(""); }} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-black px-3 text-white outline-none focus:border-yellow-400" /></label>
        <PasswordField id="master-password" label="Contraseña" required autoComplete="current-password" value={password} error={error} onChange={(event) => { setPassword(event.target.value); setError(""); }} className="bg-black" />
      </div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      <button type="submit" disabled={loading} aria-busy={loading} className="mt-6 min-h-12 w-full rounded-xl bg-yellow-400 px-4 font-black text-zinc-950 disabled:cursor-wait disabled:opacity-60">{loading ? "Ingresando…" : "Ingresar"}</button>
    </form>
  </main>;
}
