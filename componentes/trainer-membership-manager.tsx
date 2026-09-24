"use client";

import { FormEvent, useRef, useState } from "react";
import { inputClass } from "@/componentes/module-shell";

export type Subscription = {
  id: string;
  plan: "FREE" | "STARTER" | "PRO" | "PREMIUM";
  status: "ACTIVE" | "PAST_DUE" | "SUSPENDED" | "CANCELLED";
  startedAt: string;
  lastPaidAt: string | null;
  currentPeriodEnd: string | null;
  nextDueAt: string | null;
  trialEndsAt?: string | null;
  notes: string;
};

export const subscriptionLabel = { ACTIVE: "Al día", PAST_DUE: "Vencido", SUSPENDED: "Suspendido", CANCELLED: "Cancelado" } as const;
export const subscriptionBadge = { ACTIVE: "bg-emerald-400/10 text-emerald-300", PAST_DUE: "bg-red-400/10 text-red-300", SUSPENDED: "bg-orange-400/10 text-orange-300", CANCELLED: "bg-zinc-700 text-zinc-300" } as const;
export const dateInput = (value: string | null | undefined) => value?.slice(0, 10) ?? "";
const showDate = (value: string | null | undefined) => value ? new Date(value).toLocaleDateString("es-AR", { timeZone: "UTC" }) : "—";

export function TrainerMembershipManager({ trainer, subscription, onClose, onSaved }: { trainer: { id: string; name: string }; subscription: Subscription | null; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(subscription?.plan ?? "STARTER");
  const [status, setStatus] = useState(subscription?.status ?? "ACTIVE");
  const [period, setPeriod] = useState("1");
  const [renewalDate, setRenewalDate] = useState("");
  const [reactivationDate, setReactivationDate] = useState(dateInput(subscription?.nextDueAt));

  async function request(body: Record<string, unknown>, path = "", message = "Membresía actualizada") {
    if (busy.current) return;
    busy.current = true;
    setSaving(true); setError("");
    try {
      const response = await fetch(`/api/platform/trainers/${encodeURIComponent(trainer.id)}/membership${path}`, { method: path ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "No se pudo guardar la membresía.");
      await onSaved(message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo guardar la membresía."); }
    finally { busy.current = false; setSaving(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const form = new FormData(event.currentTarget);
    if (status === "CANCELLED" && !window.confirm("Cancelar suspenderá el acceso y conservará todos los datos. ¿Continuar?")) return;
    await request({
      plan, status, startedAt: form.get("startedAt"), lastPaidAt: form.get("lastPaidAt"),
      currentPeriodEnd: form.get("currentPeriodEnd") || (!subscription ? form.get("nextDueAt") : ""), nextDueAt: form.get("nextDueAt"), notes: form.get("notes"),
      suspendAccess: form.get("suspendAccess") === "on",
    });
  }

  return <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/85 p-3 sm:p-4" onPointerDown={() => { if (!saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="membership-title" className="my-2 w-full max-w-2xl rounded-3xl border border-yellow-400/20 bg-zinc-900 p-4 sm:p-6" onPointerDown={(event) => event.stopPropagation()}>
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.18em] text-yellow-400">Membresía comercial</p><h2 id="membership-title" className="mt-1 truncate text-xl font-black sm:text-2xl">{trainer.name}</h2><p className="mt-1 text-xs text-zinc-400">{plan} · {subscriptionLabel[status]}</p></div><button type="button" disabled={saving} onClick={onClose} className="min-h-10 shrink-0 text-sm text-zinc-400 disabled:opacity-50">Cerrar</button></div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
      <form onSubmit={save} className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">Plan<select name="plan" value={plan} onChange={(event) => setPlan(event.target.value as typeof plan)} className={`${inputClass} mt-1`}><option>FREE</option><option>STARTER</option><option>PRO</option><option>PREMIUM</option></select></label>
        <label className="text-sm">Estado<select name="status" value={status} onChange={(event) => setStatus(event.target.value as typeof status)} className={`${inputClass} mt-1`}><option value="ACTIVE">Al día</option><option value="PAST_DUE">Vencido</option><option value="SUSPENDED">Suspendido</option><option value="CANCELLED">Cancelado</option></select></label>
        <label className="text-sm sm:col-span-2">Próximo vencimiento<input name="nextDueAt" type="date" defaultValue={dateInput(subscription?.nextDueAt)} className={`${inputClass} mt-1`} /></label>
        <label className="text-sm sm:col-span-2">Notas internas<textarea name="notes" maxLength={2000} defaultValue={subscription?.notes ?? ""} rows={2} className={`${inputClass} mt-1 min-h-16 py-3`} /></label>
        {subscription && <div className="rounded-xl border border-zinc-800 bg-black/20 p-3 text-sm sm:col-span-2"><p className="text-xs text-zinc-500">Período actual</p><p className="mt-1 font-semibold">{showDate(subscription.lastPaidAt ?? subscription.startedAt)} → {showDate(subscription.currentPeriodEnd)}</p></div>}
        <details className="text-sm text-zinc-400 sm:col-span-2"><summary className="cursor-pointer py-2">Más información y fechas internas</summary><div className="mt-2 grid gap-3 rounded-xl border border-zinc-800 p-3 sm:grid-cols-2"><label>Inicio<input name="startedAt" type="date" required defaultValue={dateInput(subscription?.startedAt) || new Date().toISOString().slice(0, 10)} className={`${inputClass} mt-1`} /></label><label>Último pago<input name="lastPaidAt" type="date" defaultValue={dateInput(subscription?.lastPaidAt)} className={`${inputClass} mt-1`} /></label><label className="sm:col-span-2">Fin del período<input name="currentPeriodEnd" type="date" defaultValue={dateInput(subscription?.currentPeriodEnd)} className={`${inputClass} mt-1`} /></label></div></details>
        {status === "SUSPENDED" && <label className="flex items-start gap-2 text-sm text-zinc-300 sm:col-span-2"><input name="suspendAccess" type="checkbox" className="mt-1" />Suspender también el acceso del usuario.</label>}
        <button disabled={saving} className="min-h-11 rounded-xl bg-yellow-400 font-black text-zinc-950 disabled:opacity-60 sm:col-span-2">{saving ? "Guardando..." : subscription ? "Guardar membresía" : "Configurar membresía"}</button>
      </form>
      {subscription && <div className="mt-5 grid gap-3 border-t border-zinc-800 pt-5 sm:grid-cols-2">
        <section className="rounded-2xl bg-black/30 p-3 sm:p-4"><h3 className="font-bold">Marcar como pagado</h3><p className="mt-1 text-xs text-zinc-500">Actualiza el último pago, período y vencimiento.</p><select value={period} onChange={(event) => setPeriod(event.target.value)} className={`${inputClass} mt-3`}><option value="1">1 mes</option><option value="3">3 meses</option><option value="6">6 meses</option><option value="12">12 meses</option><option value="manual">Fecha manual</option></select>{period === "manual" && <input aria-label="Fecha de renovación manual" type="date" value={renewalDate} onChange={(event) => setRenewalDate(event.target.value)} className={`${inputClass} mt-2`} />}<button type="button" disabled={saving} onClick={() => request(period === "manual" ? { renewalDate } : { periodMonths: Number(period) }, "/mark-paid", "Pago registrado")} className="mt-3 min-h-11 w-full rounded-xl bg-emerald-400/15 font-bold text-emerald-300 disabled:opacity-50">Marcar como pagado</button></section>
        <section className="rounded-2xl bg-black/30 p-3 sm:p-4"><h3 className="font-bold">Control de acceso</h3><p className="mt-1 text-xs text-zinc-500">Sin tocar el workspace ni sus datos.</p><label className="mt-3 block text-xs text-zinc-400">Vencimiento al reactivar<input type="date" value={reactivationDate} onChange={(event) => setReactivationDate(event.target.value)} className={`${inputClass} mt-1`} /></label><div className="mt-3 grid gap-2"><button type="button" disabled={saving} onClick={() => request({ action: "REACTIVATE_ACCESS", nextDueAt: reactivationDate }, "", "Acceso reactivado")} className="min-h-11 rounded-xl bg-emerald-400/15 font-bold text-emerald-300 disabled:opacity-50">Reactivar y dejar al día</button><button type="button" disabled={saving} onClick={() => window.confirm("¿Suspender acceso sin eliminar ningún dato?") && request({ action: "SUSPEND_ACCESS" }, "", "Acceso suspendido")} className="min-h-11 rounded-xl bg-red-400/10 font-bold text-red-300 disabled:opacity-50">Suspender acceso</button></div></section>
      </div>}
    </section>
  </div>;
}
