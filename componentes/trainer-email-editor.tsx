"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { inputClass } from "@/componentes/module-shell";

export function TrainerEmailEditor({ trainerId, initialEmail }: { trainerId: string; initialEmail: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [currentEmail, setCurrentEmail] = useState(initialEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  function cancel() {
    setEmail(currentEmail);
    setError("");
    setEditing(false);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/platform/trainers/${encodeURIComponent(trainerId)}/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json() as { error?: string; message?: string; trainer?: { email: string } };
      if (!response.ok || !result.trainer) throw new Error(result.error || "No se pudieron actualizar los datos.");
      setCurrentEmail(result.trainer.email);
      setEmail(result.trainer.email);
      setEditing(false);
      setNotice(result.message || "Datos actualizados");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudieron actualizar los datos.");
    } finally {
      setSaving(false);
    }
  }

  return <div className="rounded-xl border border-zinc-800 bg-black/20 p-3">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <dt className="text-zinc-500">Email de acceso</dt>
        {!editing && <dd className="mt-1 break-all font-medium text-zinc-100">{currentEmail}</dd>}
      </div>
      {!editing && <button type="button" onClick={() => { setEditing(true); setNotice(""); }} className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-xs font-bold text-zinc-200 hover:border-yellow-400 hover:text-yellow-300">Editar datos</button>}
    </div>
    {editing && <form onSubmit={save} className="mt-3">
      <label htmlFor="trainer-email" className="sr-only">Email del entrenador</label>
      <input id="trainer-email" type="email" required autoComplete="email" autoCapitalize="none" spellCheck={false} value={email} onChange={(event) => setEmail(event.target.value)} disabled={saving} className={inputClass} />
      {error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button disabled={saving} className="min-h-10 rounded-lg bg-yellow-400 px-4 text-xs font-black text-zinc-950 disabled:opacity-60">{saving ? "Guardando..." : "Guardar"}</button>
        <button type="button" disabled={saving} onClick={cancel} className="min-h-10 rounded-lg border border-zinc-700 px-4 text-xs font-bold text-zinc-300 disabled:opacity-60">Cancelar</button>
      </div>
    </form>}
    {notice && <p role="status" className="mt-2 text-xs font-semibold text-emerald-300">{notice}</p>}
  </div>;
}
