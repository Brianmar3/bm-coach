"use client";

import { FormEvent, useState } from "react";
import { inputClass } from "@/componentes/module-shell";

export function TrainerPasswordResetForm({ token }: { token: string }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/trainer/password-reset/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: form.get("password"), confirmPassword: form.get("confirmPassword") }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo actualizar la contraseña.");
      setComplete(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo actualizar la contraseña."); }
    finally { setSaving(false); }
  }
  if (complete) return <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/[.06] p-5"><h2 className="font-black text-emerald-300">Contraseña actualizada</h2><a href="/admin/login" className="mt-4 inline-flex rounded-xl bg-yellow-400 px-4 py-3 font-black text-zinc-950">Iniciar sesión</a></div>;
  return <form onSubmit={submit} className="space-y-4"><label className="block text-sm">Nueva contraseña<input name="password" type="password" minLength={10} maxLength={128} required autoComplete="new-password" className={`${inputClass} mt-1`} /></label><label className="block text-sm">Repetir contraseña<input name="confirmPassword" type="password" minLength={10} maxLength={128} required autoComplete="new-password" className={`${inputClass} mt-1`} /></label>{error && <p role="alert" className="rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}<button disabled={saving} className="min-h-12 w-full rounded-xl bg-yellow-400 font-black text-zinc-950 disabled:opacity-60">{saving ? "Actualizando…" : "Guardar nueva contraseña"}</button></form>;
}
