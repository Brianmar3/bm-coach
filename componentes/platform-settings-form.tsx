"use client";

import { FormEvent, useState } from "react";
import type { PlatformSettingsValue } from "@/lib/platform-settings";

const field = "mt-1 min-h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-yellow-400";

export function PlatformSettingsForm({ initial }: { initial: PlatformSettingsValue }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const body = { platformName: String(form.get("platformName") ?? ""), supportEmail: String(form.get("supportEmail") ?? ""), invitationDays: Number(form.get("invitationDays")), defaultTrainerPlan: String(form.get("defaultTrainerPlan")), initialPeriodMonths: Number(form.get("initialPeriodMonths")) };
    try {
      const response = await fetch("/api/platform/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo guardar.");
      setMessage("Configuración guardada.");
    } catch (cause) { setMessage(cause instanceof Error ? cause.message : "No se pudo guardar."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={save} className="max-w-2xl rounded-xl border border-zinc-800 bg-zinc-900/80 p-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm">Nombre de plataforma<input name="platformName" required maxLength={100} defaultValue={initial.platformName} className={field} /></label>
      <label className="text-sm">Email de soporte<input name="supportEmail" type="email" maxLength={254} defaultValue={initial.supportEmail} placeholder="soporte@ejemplo.com" className={field} /></label>
      <label className="text-sm">Duración de invitaciones<select name="invitationDays" defaultValue={initial.invitationDays} className={field}>{[1, 3, 7, 14, 30].map((value) => <option key={value} value={value}>{value} {value === 1 ? "día" : "días"}</option>)}</select></label>
      <label className="text-sm">Plan para nuevos trainers<select name="defaultTrainerPlan" defaultValue={initial.defaultTrainerPlan} className={field}><option>STARTER</option><option>PRO</option><option>PREMIUM</option></select></label>
      <label className="text-sm">Período inicial sugerido<select name="initialPeriodMonths" defaultValue={initial.initialPeriodMonths} className={field}>{[1, 3, 6, 12].map((value) => <option key={value} value={value}>{value} {value === 1 ? "mes" : "meses"}</option>)}</select></label>
    </div>
    <div className="mt-5 flex items-center gap-3"><button disabled={saving} className="rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-black text-zinc-950 disabled:opacity-60">{saving ? "Guardando…" : "Guardar configuración"}</button>{message && <p role="status" className="text-sm text-zinc-400">{message}</p>}</div>
    <p className="mt-4 border-t border-zinc-800 pt-3 text-xs text-zinc-500">La identidad del panel Master continúa siendo BM Training. El branding de cada workspace se administra desde la cuenta de su entrenador.</p>
  </form>;
}
