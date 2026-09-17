"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/componentes/password-field";

export function TrainerInvitationAccept({ token, name, usable }: { token: string; name: string; usable: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (password !== confirmPassword) return setError("Las contraseñas no coinciden.");
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/trainer/invitations/${encodeURIComponent(token)}/accept`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password, confirmPassword }) });
      const result = await response.json() as { error?: string; next?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo completar la cuenta.");
      router.replace(result.next || "/trainer/onboarding"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo completar la cuenta."); }
    finally { setLoading(false); }
  }
  if (!usable) return <section className="w-full max-w-md rounded-3xl border border-red-400/20 bg-zinc-900 p-7 text-center"><h1 className="text-2xl font-black">Invitación no disponible</h1><p className="mt-3 text-sm text-zinc-400">El enlace es inválido, ya fue usado o venció.</p></section>;
  return <form noValidate onSubmit={submit} className="w-full max-w-md rounded-3xl border border-yellow-400/20 bg-zinc-900 p-7 shadow-2xl shadow-black"><p className="text-xs font-bold uppercase tracking-[.2em] text-yellow-400">BM Training</p><h1 className="mt-3 text-2xl font-black">Hola, {name}</h1><p className="mt-2 text-sm text-zinc-400">Definí tu contraseña para activar tu espacio de entrenador.</p><div className="mt-6 space-y-4"><PasswordField id="trainer-password" label="Contraseña" required minLength={10} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><PasswordField id="trainer-password-confirm" label="Repetir contraseña" required minLength={10} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></div>{error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}<button disabled={loading} aria-busy={loading} className="mt-6 min-h-12 w-full rounded-xl bg-yellow-400 font-black text-zinc-950 disabled:opacity-60">{loading ? "Creando espacio…" : "Activar mi cuenta"}</button></form>;
}
