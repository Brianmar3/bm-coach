"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { addMonthsToDateKey } from "@/lib/payment-dates";
import type { PaymentDashboard, PaymentStudentAccount } from "@/types/gestion";

type AccountFilter = "TODOS" | PaymentStudentAccount["status"];
type PaymentForm = { studentId: string; amount: number; paidDate: string; method: string; dueDate: string; notes: string };
type CreatePaymentResponse = { dashboard: PaymentDashboard };

const emptyDashboard: PaymentDashboard = {
  asOf: "",
  students: [],
  summary: { collectedThisMonth: 0, overdueCount: 0, dueSoonCount: 0, currentCount: 0, unconfiguredCount: 0, estimatedOutstanding: 0 },
};
const filters: Array<{ value: AccountFilter; label: string }> = [
  { value: "TODOS", label: "Todos" },
  { value: "VENCIDA", label: "Vencidos" },
  { value: "VENCE_PRONTO", label: "Vencen pronto" },
  { value: "AL_DIA", label: "Al día" },
  { value: "SIN_CONFIGURAR", label: "Sin configurar" },
];
const statusDetails = {
  VENCIDA: { label: "Vencida", className: "border-red-400/30 bg-red-400/10 text-red-200" },
  VENCE_PRONTO: { label: "Vence pronto", className: "border-orange-400/30 bg-orange-400/10 text-orange-200" },
  AL_DIA: { label: "Al día", className: "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" },
  SIN_CONFIGURAR: { label: "Sin configurar", className: "border-zinc-600 bg-zinc-800 text-zinc-300" },
} as const;

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}
function showDate(value: string) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR") : "Sin definir";
}
function whatsappUrl(account: PaymentStudentAccount) {
  const phone = account.phone.replace(/\D/g, "");
  const greeting = `Hola ${account.student}, te recordamos que tu cuota de ${money(account.monthlyFee)} ${account.status === "VENCIDA" ? "está vencida" : `vence el ${showDate(account.nextDueDate)}`}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(greeting)}`;
}
async function responseError(response: Response, fallback: string) {
  try { return ((await response.json()) as { error?: string }).error ?? fallback; } catch { return fallback; }
}

export default function PagosPage() {
  const [data, setData] = useState(emptyDashboard);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AccountFilter>("TODOS");
  const [form, setForm] = useState<PaymentForm | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pagos", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "No se pudo cargar el panel de pagos."));
        return response.json() as Promise<PaymentDashboard>;
      })
      .then(setData)
      .catch((loadError: unknown) => {
        if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message);
      })
      .finally(() => setReady(true));
    return () => controller.abort();
  }, []);

  const visible = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return data.students.filter((account) =>
      (!normalized || `${account.student} ${account.plan}`.toLocaleLowerCase("es").includes(normalized)) &&
      (filter === "TODOS" || account.status === filter),
    );
  }, [data.students, filter, query]);

  function begin(account: PaymentStudentAccount) {
    const paidDate = data.asOf;
    setForm({
      studentId: account.studentId,
      amount: account.monthlyFee,
      paidDate,
      method: "Transferencia",
      dueDate: addMonthsToDateKey(account.nextDueDate || paidDate),
      notes: "",
    });
    setError("");
    setNotice("");
  }

  async function createPayment(account: PaymentStudentAccount, payment: PaymentForm) {
    setSavingId(account.studentId);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/pagos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payment),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo registrar el pago."));
      const saved = await response.json() as CreatePaymentResponse;
      setData(saved.dashboard);
      setForm(null);
      setNotice(`Pago de ${account.student} registrado correctamente.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo registrar el pago.");
    } finally {
      setSavingId("");
    }
  }

  async function paidToday(account: PaymentStudentAccount) {
    if (!window.confirm(`¿Registrar el pago de ${money(account.monthlyFee)} de ${account.student} hoy?`)) return;
    const paidDate = data.asOf;
    await createPayment(account, {
      studentId: account.studentId,
      amount: account.monthlyFee,
      paidDate,
      method: "Transferencia",
      dueDate: addMonthsToDateKey(account.nextDueDate || paidDate),
      notes: "Registro rápido: Pagó hoy",
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const account = data.students.find((item) => item.studentId === form.studentId);
    if (!account) { setError("El alumno ya no está disponible."); return; }
    await createPayment(account, form);
  }

  const summary = data.summary;
  return <ModuleShell title="Pagos" subtitle="Estado de cuotas y cobros rápidos desde el celular." action={null}>
    {(error || notice) && !form && <p role={error ? "alert" : "status"} className={`mb-5 rounded-xl border p-4 text-sm ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error || notice}</p>}

    <section className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <Summary label="Cobrado este mes" value={money(summary.collectedThisMonth)} tone="green" wide />
      <Summary label="Vencidos" value={String(summary.overdueCount)} tone="red" />
      <Summary label="Vencen pronto" value={String(summary.dueSoonCount)} tone="orange" />
      <Summary label="Al día" value={String(summary.currentCount)} tone="green" />
      <Summary label="Pendiente estimado" value={money(summary.estimatedOutstanding)} tone="yellow" wide />
    </section>

    <section className="mt-5 space-y-3">
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar alumno o plan" className={inputClass} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`shrink-0 rounded-xl px-4 py-3 text-sm font-semibold ${filter === item.value ? "bg-yellow-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}>{item.label}</button>)}
      </div>
    </section>

    <section className="mt-5 grid gap-4 lg:grid-cols-2">
      {!ready ? <p className="rounded-2xl bg-zinc-900 p-10 text-center text-zinc-500 lg:col-span-2">Cargando cuotas…</p>
        : visible.length === 0 ? <p className="rounded-2xl bg-zinc-900 p-10 text-center text-zinc-500 lg:col-span-2">No hay alumnos que coincidan con el filtro.</p>
        : visible.map((account) => <AccountCard key={account.studentId} account={account} saving={savingId === account.studentId} begin={() => begin(account)} paidToday={() => paidToday(account)} />)}
    </section>

    {form && <PaymentModal form={form} account={data.students.find((item) => item.studentId === form.studentId)!} setForm={setForm} error={error} saving={Boolean(savingId)} close={() => { setForm(null); setError(""); }} submit={submit} />}
  </ModuleShell>;
}

function Summary({ label, value, tone, wide = false }: { label: string; value: string; tone: "red" | "orange" | "green" | "yellow"; wide?: boolean }) {
  const color = { red: "text-red-300", orange: "text-orange-300", green: "text-emerald-300", yellow: "text-yellow-300" }[tone];
  return <div className={`rounded-2xl border border-zinc-800 bg-zinc-900 p-4 ${wide ? "col-span-2 lg:col-span-1" : ""}`}><p className="text-xs text-zinc-500">{label}</p><p className={`mt-1 text-xl font-bold sm:text-2xl ${color}`}>{value}</p></div>;
}

function AccountCard({ account, saving, begin, paidToday }: { account: PaymentStudentAccount; saving: boolean; begin: () => void; paidToday: () => void }) {
  const status = statusDetails[account.status];
  const canMessage = Boolean(account.phone) && (account.status === "VENCIDA" || account.status === "VENCE_PRONTO");
  return <article className={`rounded-2xl border p-4 shadow-lg ${status.className}`}>
    <div className="flex items-start justify-between gap-3"><div><h2 className="text-lg font-bold text-white">{account.student}</h2><p className="mt-1 text-sm text-zinc-400">{account.plan}</p></div><span className="shrink-0 rounded-full bg-black/25 px-3 py-1 text-xs font-bold">{status.label}</span></div>
    <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-black/20 p-3 text-sm">
      <Info label="Cuota mensual" value={money(account.monthlyFee)} />
      <Info label="Próximo vencimiento" value={showDate(account.nextDueDate)} />
      <Info label="Último pago" value={showDate(account.lastPaymentDate)} />
      <Info label="Importe último pago" value={account.lastPaymentAmount === null ? "Sin pagos" : money(account.lastPaymentAmount)} />
    </div>
    <div className="mt-4 grid grid-cols-2 gap-2">
      <button onClick={begin} disabled={saving} className="rounded-xl border border-yellow-400/60 px-3 py-3 font-bold text-yellow-300 disabled:opacity-50">Registrar pago</button>
      <button onClick={paidToday} disabled={saving || account.monthlyFee <= 0} className="rounded-xl bg-yellow-400 px-3 py-3 font-bold text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : "Pagó hoy"}</button>
      {canMessage && <a href={whatsappUrl(account)} target="_blank" rel="noreferrer" className="col-span-2 rounded-xl border border-emerald-400/50 px-3 py-3 text-center font-bold text-emerald-300">Abrir WhatsApp</a>}
    </div>
  </article>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-semibold text-zinc-100">{value}</p></div>;
}

function PaymentModal({ form, account, setForm, error, saving, close, submit }: { form: PaymentForm; account: PaymentStudentAccount; setForm: (form: PaymentForm) => void; error: string; saving: boolean; close: () => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-3"><form onSubmit={submit} className="mx-auto my-4 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-white shadow-2xl sm:my-10 sm:p-6">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-yellow-400">Registrar pago</p><h2 className="mt-1 text-xl font-bold">{account.student}</h2><p className="mt-1 text-sm text-zinc-400">{account.plan}</p></div><button type="button" onClick={close} disabled={saving} className="p-2 text-zinc-400">Cerrar</button></div>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm">Importe<input required type="number" min="1" step="0.01" inputMode="decimal" value={form.amount || ""} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} className={`${inputClass} mt-1`} /></label>
      <label className="text-sm">Fecha de pago<input required type="date" value={form.paidDate} onChange={(event) => setForm({ ...form, paidDate: event.target.value })} className={`${inputClass} mt-1`} /></label>
      <label className="text-sm">Medio de pago<select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} className={`${inputClass} mt-1`}><option>Transferencia</option><option>Efectivo</option><option>Mercado Pago</option><option>Tarjeta</option></select></label>
      <label className="text-sm">Próximo vencimiento<input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className={`${inputClass} mt-1`} /></label>
      <label className="text-sm sm:col-span-2">Observaciones<textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className={`${inputClass} mt-1`} /></label>
    </div>
    <button disabled={saving} className="mt-6 w-full rounded-xl bg-yellow-400 px-5 py-4 font-bold text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : `Registrar ${money(form.amount)}`}</button>
  </form></div>;
}
