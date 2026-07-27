"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { addMonthsToDateKey } from "@/lib/payment-dates";
import type { Payment, PaymentDashboard, PaymentStudentAccount } from "@/types/gestion";

type AccountFilter = "TODOS" | PaymentStudentAccount["status"] | "PAGADOS_MES";
type PaymentForm = {
  paymentId?: string;
  studentId: string;
  amount: number;
  paidDate: string;
  billingPeriod: string;
  method: string;
  dueDate: string;
  notes: string;
  requestKey: string;
  mode: "create" | "quick" | "edit";
};

const emptyDashboard: PaymentDashboard = {
  asOf: "",
  students: [],
  summary: { collectedThisMonth: 0, overdueCount: 0, dueSoonCount: 0, currentCount: 0, noPaymentCount: 0, unconfiguredCount: 0, estimatedOutstanding: 0 },
};
const filters: Array<{ value: AccountFilter; label: string }> = [
  { value: "TODOS", label: "Todos" },
  { value: "VENCIDA", label: "Vencidos" },
  { value: "VENCE_PRONTO", label: "Vencen pronto" },
  { value: "AL_DIA", label: "Al día" },
  { value: "SIN_CONFIGURAR", label: "Sin configurar" },
  { value: "SIN_PAGOS", label: "Sin pagos" },
  { value: "PAGADOS_MES", label: "Pagados este mes" },
];
const paymentMethods = ["Efectivo", "Transferencia", "Mercado Pago", "Otro"];
const statusDetails = {
  VENCIDA: { label: "Vencido", className: "bg-red-400/10 text-red-200 ring-red-400/30" },
  VENCE_PRONTO: { label: "Vence pronto", className: "bg-orange-400/10 text-orange-200 ring-orange-400/30" },
  AL_DIA: { label: "Al día", className: "bg-emerald-400/10 text-emerald-200 ring-emerald-400/30" },
  SIN_PAGOS: { label: "Sin pagos", className: "bg-yellow-400/10 text-yellow-200 ring-yellow-400/30" },
  SIN_CONFIGURAR: { label: "Sin configurar", className: "bg-zinc-800 text-zinc-300 ring-zinc-700" },
} as const;

function money(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
}
function showDate(value: string) {
  return value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("es-AR") : "Sin definir";
}
function monthLabel(value: string) {
  if (!value) return "Sin período";
  const result = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00Z`));
  return result.charAt(0).toUpperCase() + result.slice(1);
}
function whatsappUrl(account: PaymentStudentAccount) {
  const phone = account.phone.replace(/\D/g, "");
  const greeting = `Hola ${account.student}, te recordamos que tu cuota de ${money(account.monthlyFee)} ${account.status === "VENCIDA" ? "está vencida" : `vence el ${showDate(account.nextDueDate)}`}.`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(greeting)}`;
}
async function responseError(response: Response, fallback: string) {
  try { return ((await response.json()) as { error?: string }).error ?? fallback; } catch { return fallback; }
}
function currentPeriod(dateKey: string) {
  return dateKey ? `${dateKey.slice(0, 7)}-01` : "";
}

export default function PagosPage() {
  const [data, setData] = useState(emptyDashboard);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<AccountFilter>("TODOS");
  const [form, setForm] = useState<PaymentForm | null>(null);
  const [historyAccount, setHistoryAccount] = useState<PaymentStudentAccount | null>(null);
  const [history, setHistory] = useState<Payment[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedId, setExpandedId] = useState("");
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
    return data.students.filter((account) => {
      const status = statusDetails[account.status].label;
      const matchesQuery = !normalized || `${account.student} ${account.plan} ${account.phone} ${status}`.toLocaleLowerCase("es").includes(normalized);
      const matchesFilter = filter === "TODOS"
        || account.status === filter
        || (filter === "PAGADOS_MES" && account.paidThisMonth);
      return matchesQuery && matchesFilter;
    });
  }, [data.students, filter, query]);

  function blankForm(account?: PaymentStudentAccount, mode: PaymentForm["mode"] = "create"): PaymentForm {
    const paidDate = data.asOf;
    return {
      studentId: account?.studentId ?? data.students[0]?.studentId ?? "",
      amount: account?.monthlyFee ?? data.students[0]?.monthlyFee ?? 0,
      paidDate,
      billingPeriod: currentPeriod(paidDate),
      method: "Transferencia",
      dueDate: addMonthsToDateKey(account?.nextDueDate || paidDate),
      notes: mode === "quick" ? "Registro rápido: Pagó hoy" : "",
      requestKey: crypto.randomUUID(),
      mode,
    };
  }

  function begin(account?: PaymentStudentAccount) {
    setForm(blankForm(account));
    setError("");
    setNotice("");
  }

  function paidToday(account: PaymentStudentAccount) {
    setForm(blankForm(account, "quick"));
    setError("");
    setNotice("");
  }

  async function loadHistory(account: PaymentStudentAccount) {
    setHistoryAccount(account);
    setHistory([]);
    setHistoryLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/pagos?studentId=${encodeURIComponent(account.studentId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo cargar el historial."));
      setHistory(await response.json() as Payment[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar el historial.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form || savingId) return;
    const account = data.students.find((item) => item.studentId === form.studentId);
    if (!account) { setError("El alumno ya no está disponible."); return; }
    setSavingId(form.paymentId ?? form.studentId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(form.paymentId ? `/api/pagos/${form.paymentId}` : "/api/pagos", {
        method: form.paymentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo guardar el pago."));
      const saved = await response.json() as { dashboard: PaymentDashboard; payment: Payment };
      setData(saved.dashboard);
      setForm(null);
      setNotice(form.paymentId ? "Pago actualizado correctamente." : `Pago de ${account.student} registrado correctamente.`);
      if (historyAccount?.studentId === account.studentId) await loadHistory(account);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el pago.");
    } finally {
      setSavingId("");
    }
  }

  function editPayment(payment: Payment) {
    setForm({
      paymentId: payment.id,
      studentId: payment.studentId,
      amount: payment.amount,
      paidDate: payment.paidDate,
      billingPeriod: payment.billingPeriod || currentPeriod(payment.paidDate),
      method: paymentMethods.includes(payment.method) ? payment.method : "Otro",
      dueDate: "",
      notes: payment.notes,
      requestKey: "",
      mode: "edit",
    });
    setError("");
  }

  async function voidPayment(payment: Payment) {
    const reason = window.prompt(`Vas a anular el pago de ${money(payment.amount)} registrado el ${showDate(payment.paidDate)} para ${payment.student}. El pago dejará de sumar, pero seguirá en el historial.\n\nIngresá el motivo de anulación:`);
    if (!reason?.trim() || savingId) return;
    setSavingId(payment.id);
    setError("");
    try {
      const response = await fetch(`/api/pagos/${payment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "void", reason }),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo anular el pago."));
      const result = await response.json() as { dashboard: PaymentDashboard; warning?: string | null };
      setData(result.dashboard);
      setNotice(result.warning ? `Pago anulado correctamente. ${result.warning}` : "Pago anulado correctamente.");
      if (historyAccount) await loadHistory(historyAccount);
    } catch (voidError) {
      setError(voidError instanceof Error ? voidError.message : "No se pudo anular el pago.");
    } finally {
      setSavingId("");
    }
  }

  const summary = data.summary;
  return <ModuleShell title="Pagos" subtitle="Cuotas, cobros e historial." action={<button onClick={() => begin()} className="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-zinc-950">+ Agregar pago</button>}>
    {(error || notice) && !form && <p role={error ? "alert" : "status"} className={`mb-4 rounded-xl border p-3 text-sm ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error || notice}</p>}

    <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">Cobrado este mes</p>
      <p className="mt-1 text-2xl font-bold text-emerald-300">{ready ? money(summary.collectedThisMonth) : <span className="inline-block h-7 w-32 animate-pulse rounded bg-zinc-800" />}</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniSummary label="Vencidos" value={summary.overdueCount} tone="text-red-300" ready={ready} />
        <MiniSummary label="Vencen pronto" value={summary.dueSoonCount} tone="text-orange-300" ready={ready} />
        <MiniSummary label="Al día" value={summary.currentCount} tone="text-emerald-300" ready={ready} />
        <MiniSummary label="Sin pagos" value={summary.noPaymentCount} tone="text-yellow-200" ready={ready} />
        <MiniSummary label="Pendiente estimado" value={money(summary.estimatedOutstanding)} tone="text-yellow-300" ready={ready} />
      </div>
    </section>

    <section className="mt-4 space-y-3">
      <div className="flex gap-2"><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre, plan, teléfono o estado" className={inputClass} /><button onClick={() => begin()} className="shrink-0 rounded-xl border border-yellow-400/50 px-3 text-sm font-bold text-yellow-300 sm:hidden">+</button></div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${filter === item.value ? "bg-yellow-400 text-zinc-950" : "bg-zinc-800 text-zinc-300"}`}>{item.label}</button>)}
      </div>
    </section>

    <section className="mt-4 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
      {!ready ? <div className="space-y-px">{Array.from({ length: 8 }, (_, index) => <div key={index} className="h-20 animate-pulse bg-zinc-900 p-4"><div className="h-4 w-36 rounded bg-zinc-800" /><div className="mt-2 h-3 w-52 rounded bg-zinc-800" /></div>)}</div>
        : visible.length === 0 ? <p className="p-10 text-center text-zinc-500">No hay alumnos que coincidan con el filtro.</p>
        : visible.map((account) => <AccountRow key={account.studentId} account={account} expanded={expandedId === account.studentId} saving={savingId === account.studentId} toggle={() => setExpandedId((value) => value === account.studentId ? "" : account.studentId)} begin={() => begin(account)} paidToday={() => paidToday(account)} history={() => loadHistory(account)} />)}
    </section>

    {form && <PaymentModal form={form} accounts={data.students} setForm={setForm} error={error} saving={Boolean(savingId)} close={() => { setForm(null); setError(""); }} submit={submit} />}
    {historyAccount && <HistoryModal account={historyAccount} payments={history} loading={historyLoading} savingId={savingId} close={() => setHistoryAccount(null)} edit={editPayment} voidPayment={voidPayment} />}
  </ModuleShell>;
}

function MiniSummary({ label, value, tone, ready }: { label: string; value: string | number; tone: string; ready: boolean }) {
  return <div className="rounded-xl bg-zinc-950 px-3 py-2"><p className="text-[11px] text-zinc-500">{label}</p>{ready ? <p className={`mt-1 text-sm font-bold ${tone}`}>{value}</p> : <span className="mt-1 block h-4 w-12 animate-pulse rounded bg-zinc-800" />}</div>;
}

function AccountRow({ account, expanded, saving, toggle, begin, paidToday, history }: { account: PaymentStudentAccount; expanded: boolean; saving: boolean; toggle: () => void; begin: () => void; paidToday: () => void; history: () => void }) {
  const status = statusDetails[account.status];
  const canMessage = Boolean(account.phone) && (account.status === "VENCIDA" || account.status === "VENCE_PRONTO");
  return <article className="border-b border-zinc-800 last:border-b-0">
    <div className="flex items-center gap-3 p-3 sm:p-4">
      <button onClick={toggle} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-bold text-white">{account.student}</h2><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${status.className}`}>{status.label}</span></div>
        <p className="mt-1 truncate text-xs text-zinc-400">{account.plan || "Sin plan"} · {money(account.monthlyFee)}</p>
        <p className="mt-1 text-xs text-zinc-500">Vence: {showDate(account.nextDueDate)}{account.lastPaymentDate ? ` · Último: ${showDate(account.lastPaymentDate)}` : " · Sin pagos"}</p>
      </button>
      <details className="relative">
        <summary className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg bg-zinc-800 text-xl text-zinc-300" aria-label={`Acciones de ${account.student}`}>⋮</summary>
        <div className="absolute right-0 z-20 mt-2 w-52 rounded-xl border border-zinc-700 bg-zinc-950 p-1.5 text-sm shadow-2xl">
          <button onClick={begin} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-zinc-800">Agregar pago</button>
          <button onClick={paidToday} disabled={saving || account.monthlyFee <= 0} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-zinc-800 disabled:opacity-40">Pagó hoy</button>
          <button onClick={history} className="block w-full rounded-lg px-3 py-2 text-left hover:bg-zinc-800">Ver historial</button>
          <Link href={`/alumnos?buscar=${encodeURIComponent(account.student)}`} className="block rounded-lg px-3 py-2 hover:bg-zinc-800">Editar configuración de pago</Link>
          {canMessage && <a href={whatsappUrl(account)} target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-2 text-emerald-300 hover:bg-zinc-800">Abrir WhatsApp</a>}
        </div>
      </details>
    </div>
    {expanded && <div className="grid gap-2 border-t border-zinc-800 bg-zinc-950/50 p-3 text-sm sm:grid-cols-4"><Info label="Cuota mensual" value={money(account.monthlyFee)} /><Info label="Próximo vencimiento" value={showDate(account.nextDueDate)} /><Info label="Último pago" value={showDate(account.lastPaymentDate)} /><Info label="Importe último pago" value={account.lastPaymentAmount === null ? "Sin pagos" : money(account.lastPaymentAmount)} /><div className="flex flex-wrap gap-2 sm:col-span-4"><button onClick={begin} className="rounded-lg border border-yellow-400/50 px-3 py-2 text-xs font-bold text-yellow-300">Agregar pago</button><button onClick={history} className="rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold">Ver historial</button></div></div>}
  </article>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-zinc-500">{label}</p><p className="mt-0.5 font-semibold text-zinc-100">{value}</p></div>;
}

function PaymentModal({ form, accounts, setForm, error, saving, close, submit }: { form: PaymentForm; accounts: PaymentStudentAccount[]; setForm: (form: PaymentForm) => void; error: string; saving: boolean; close: () => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  const account = accounts.find((item) => item.studentId === form.studentId);
  const title = form.mode === "edit" ? "Editar pago" : form.mode === "quick" ? "Confirmar “Pagó hoy”" : "Agregar pago";
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-3"><form onSubmit={submit} className="mx-auto my-4 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-white shadow-2xl sm:my-10">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-yellow-400">{title}</p><h2 className="mt-1 text-lg font-bold">{account?.student ?? "Seleccioná un alumno"}</h2>{form.mode === "quick" && <p className="mt-1 text-xs text-zinc-400">Revisá importe y fecha antes de confirmar.</p>}</div><button type="button" onClick={close} disabled={saving} className="p-2 text-zinc-400">Cerrar</button></div>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">Alumno<select disabled={form.mode === "edit"} value={form.studentId} onChange={(event) => { const selected = accounts.find((item) => item.studentId === event.target.value); setForm({ ...form, studentId: event.target.value, amount: selected?.monthlyFee ?? form.amount, dueDate: addMonthsToDateKey(selected?.nextDueDate || form.paidDate) }); }} className={`${inputClass} mt-1`}>{accounts.map((item) => <option key={item.studentId} value={item.studentId}>{item.student}</option>)}</select></label>
      <label className="text-sm">Importe<input required type="number" min="1" step="0.01" inputMode="decimal" value={form.amount || ""} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} className={`${inputClass} mt-1`} /></label>
      <label className="text-sm">Fecha de pago<input required type="date" value={form.paidDate} onChange={(event) => setForm({ ...form, paidDate: event.target.value })} className={`${inputClass} mt-1`} /></label>
      <label className="text-sm">Período abonado<input required type="month" value={form.billingPeriod.slice(0, 7)} onChange={(event) => setForm({ ...form, billingPeriod: `${event.target.value}-01` })} className={`${inputClass} mt-1`} /></label>
      <label className="text-sm">Medio de pago<select value={form.method} onChange={(event) => setForm({ ...form, method: event.target.value })} className={`${inputClass} mt-1`}>{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label>
      {form.mode !== "edit" && <label className="text-sm sm:col-span-2">Próximo vencimiento<input required type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className={`${inputClass} mt-1`} /></label>}
      <label className="text-sm sm:col-span-2">Nota opcional<textarea rows={2} maxLength={1000} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className={`${inputClass} mt-1`} /></label>
    </div>
    <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={close} disabled={saving} className="rounded-lg bg-zinc-800 px-4 py-2.5 text-sm font-bold">Cancelar</button><button disabled={saving || !form.studentId} className="rounded-lg bg-yellow-400 px-4 py-2.5 text-sm font-bold text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : form.mode === "edit" ? "Guardar cambios" : `Registrar ${money(form.amount)}`}</button></div>
  </form></div>;
}

function HistoryModal({ account, payments, loading, savingId, close, edit, voidPayment }: { account: PaymentStudentAccount; payments: Payment[]; loading: boolean; savingId: string; close: () => void; edit: (payment: Payment) => void; voidPayment: (payment: Payment) => void }) {
  return <div className="fixed inset-0 z-40 overflow-y-auto bg-black/85 p-3"><section className="mx-auto my-4 w-full max-w-xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-white shadow-2xl sm:my-10">
    <div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-yellow-400">Historial de pagos</p><h2 className="mt-1 text-xl font-bold">{account.student}</h2></div><button onClick={close} className="p-2 text-zinc-400">Cerrar</button></div>
    <div className="mt-5 space-y-2">{loading ? <p className="rounded-xl bg-zinc-950 p-8 text-center text-zinc-500">Cargando historial…</p> : payments.length === 0 ? <p className="rounded-xl bg-zinc-950 p-8 text-center text-zinc-500">Este alumno todavía no tiene pagos.</p> : payments.map((payment) => <article key={payment.id} className={`rounded-xl border p-3 ${payment.status === "anulado" ? "border-red-400/20 bg-red-400/5 opacity-70" : "border-zinc-800 bg-zinc-950"}`}><div className="flex items-start justify-between gap-3"><div><p className="font-bold">{showDate(payment.paidDate)} {payment.status === "anulado" && <span className="ml-2 rounded bg-red-400/10 px-2 py-0.5 text-[10px] text-red-300">ANULADO</span>}</p><p className="mt-1 text-sm text-zinc-300">{money(payment.amount)} · {monthLabel(payment.billingPeriod)}</p><p className="mt-1 text-xs text-zinc-500">{payment.method} · Cargado {showDate(payment.createdAt)}</p>{payment.notes && <p className="mt-2 text-xs text-zinc-400">{payment.notes}</p>}{payment.voidReason && <p className="mt-2 text-xs text-red-300">Motivo: {payment.voidReason}</p>}</div>{payment.status !== "anulado" && <details className="relative"><summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-lg bg-zinc-800 text-lg">⋮</summary><div className="absolute right-0 z-10 mt-1 w-36 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl"><button onClick={() => edit(payment)} className="block w-full rounded px-2 py-2 text-left text-xs hover:bg-zinc-800">Editar pago</button><button onClick={() => voidPayment(payment)} disabled={savingId === payment.id} className="block w-full rounded px-2 py-2 text-left text-xs text-red-300 hover:bg-zinc-800 disabled:opacity-50">Anular pago</button></div></details>}</div></article>)}</div>
    <p className="mt-4 text-xs text-zinc-600">Registrado por el entrenador autenticado de BM Training.</p>
  </section></div>;
}
