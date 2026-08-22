"use client";

import { type FormEvent, type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { ErrorState } from "@/componentes/async-states";
import { TrainerFloatingActions } from "@/componentes/trainer-floating-actions";
import { useEnterFieldNavigation, useEscapeLayer } from "@/componentes/use-trainer-keyboard-interactions";
import { addMonthsToDateKey } from "@/lib/payment-dates";
import { apiRequest } from "@/lib/client-api";
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
const statusAccent: Record<PaymentStudentAccount["status"], string> = {
  VENCIDA: "bg-red-400",
  VENCE_PRONTO: "bg-orange-400",
  AL_DIA: "bg-emerald-400",
  SIN_PAGOS: "bg-yellow-300",
  SIN_CONFIGURAR: "bg-zinc-500",
};

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
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
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
  const paymentSaveLock = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/pagos", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "No se pudo cargar el panel de pagos."));
        return response.json() as Promise<PaymentDashboard>;
      })
      .then((dashboard) => {
        setData(dashboard);
        setLoadError("");
        const params = new URLSearchParams(window.location.search);
        if (params.get("accion") === "nuevo") {
          const account = dashboard.students.find((item) => item.studentId === params.get("studentId"));
          const paidDate = dashboard.asOf;
          setForm({ studentId: account?.studentId ?? "", amount: account?.monthlyFee ?? 0, paidDate, billingPeriod: currentPeriod(paidDate), method: "Transferencia", dueDate: addMonthsToDateKey(account?.nextDueDate || paidDate), notes: "", requestKey: crypto.randomUUID(), mode: "create" });
        }
      })
      .catch((value: unknown) => {
        if (value instanceof Error && value.name !== "AbortError") setLoadError("No pudimos cargar el panel de pagos.");
      })
      .finally(() => setReady(true));
    return () => controller.abort();
  }, [reload]);

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
      studentId: account?.studentId ?? "",
      amount: account?.monthlyFee ?? 0,
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
    if (!form || paymentSaveLock.current) return;
    const account = data.students.find((item) => item.studentId === form.studentId);
    if (!account) { setError("El alumno ya no está disponible."); return; }
    paymentSaveLock.current = true;
    setSavingId(form.paymentId ?? form.studentId);
    setError("");
    setNotice("");
    try {
      const saved = await apiRequest<{ dashboard: PaymentDashboard | null; payment: Payment }>(form.paymentId ? `/api/pagos/${form.paymentId}` : "/api/pagos", {
        method: form.paymentId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form.paymentId ? form : { ...form, nextDueDate: form.dueDate, dueDate: undefined }),
      }, { fallback: "No se pudo guardar el pago.", scope: "admin" });
      if (saved.dashboard) setData(saved.dashboard);
      setForm(null);
      setNotice(form.paymentId ? "Pago actualizado correctamente." : `Pago de ${account.student} registrado correctamente.`);
      if (!form.paymentId) {
        try {
          setData(await apiRequest<PaymentDashboard>("/api/pagos", { cache: "no-store" }, { fallback: "No se pudo actualizar el panel de pagos.", scope: "admin" }));
        } catch {
          setNotice(`Pago de ${account.student} registrado. No pudimos actualizar la lista; los datos guardados se mantienen.`);
        }
      }
      if (historyAccount?.studentId === account.studentId) await loadHistory(account);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el pago.");
    } finally {
      paymentSaveLock.current = false;
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
  function retryLoad() {
    setLoadError("");
    if (!data.students.length) setReady(false);
    setReload((value) => value + 1);
  }
  if (ready && loadError && data.students.length === 0)
    return <ModuleShell title="Pagos" subtitle="Cuotas, cobros e historial."><ErrorState title="No pudimos cargar los pagos." description="Revisá la conexión e intentá nuevamente." retry={retryLoad}/></ModuleShell>;
  return <ModuleShell title="Pagos" subtitle="Cuotas, cobros e historial.">
    {(error || notice) && !form && <p role={error ? "alert" : "status"} className={`mb-4 rounded-xl border p-3 text-sm ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error || notice}</p>}
    {loadError && <div className="mb-4"><ErrorState compact title="No pudimos actualizar los pagos." description="Seguís viendo la última información disponible." retry={retryLoad}/></div>}

    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-lg shadow-black/10 sm:p-5">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-zinc-500">Cobrado este mes</p><p className="mt-1 text-3xl font-bold tracking-tight text-emerald-300 sm:text-4xl">{ready ? money(summary.collectedThisMonth) : <span className="inline-block h-9 w-40 animate-pulse rounded bg-zinc-800" />}</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-yellow-400/15 bg-yellow-400/5 text-yellow-300"><PaymentIcon name="trend" /></span></div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        <MiniSummary label="Vencidos" value={summary.overdueCount} tone="text-red-300" icon="overdue" ready={ready} />
        <MiniSummary label="Vencen pronto" value={summary.dueSoonCount} tone="text-orange-300" icon="calendar" ready={ready} />
        <MiniSummary label="Al día" value={summary.currentCount} tone="text-emerald-300" icon="check" ready={ready} />
        <MiniSummary label="Sin pagos" value={summary.noPaymentCount} tone="text-yellow-200" icon="student" ready={ready} />
        <div className="col-span-2 flex min-h-16 items-center justify-between rounded-xl border border-yellow-400/10 bg-black/25 px-3.5 py-3 lg:col-span-4"><div><p className="text-xs text-zinc-500">Pendiente estimado</p>{ready ? <p className="mt-0.5 text-lg font-bold text-yellow-300">{money(summary.estimatedOutstanding)}</p> : <span className="mt-1 block h-5 w-24 animate-pulse rounded bg-zinc-800" />}</div><span className="text-yellow-300/60"><PaymentIcon name="wallet" /></span></div>
      </div>
    </section>

    <section aria-label="Buscar y filtrar pagos" className="mt-4 space-y-3">
      <div className="relative"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"><PaymentIcon name="search" /></span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre, plan, teléfono o estado" className={`${inputClass} w-full pl-11`} /></div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {filters.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} aria-pressed={filter === item.value} className={`min-h-10 shrink-0 rounded-xl border px-3 text-sm font-semibold transition ${filter === item.value ? "border-yellow-400/70 bg-yellow-400/10 text-yellow-200 shadow-[0_0_18px_rgba(250,204,21,.06)]" : "border-zinc-800 bg-zinc-900/70 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"}`}>{item.label}</button>)}
      </div>
    </section>

    <section aria-label="Alumnos y cuotas" className="mt-4 space-y-2">
      {!ready ? <div className="space-y-2">{Array.from({ length: 6 }, (_, index) => <div key={index} className="h-24 animate-pulse rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4"><div className="h-4 w-36 rounded bg-zinc-800" /><div className="mt-2 h-3 w-52 rounded bg-zinc-800" /></div>)}</div>
        : visible.length === 0 ? <p className="p-10 text-center text-zinc-500">No hay alumnos que coincidan con el filtro.</p>
        : visible.map((account) => <AccountRow key={account.studentId} account={account} expanded={expandedId === account.studentId} saving={savingId === account.studentId} toggle={() => setExpandedId((value) => value === account.studentId ? "" : account.studentId)} begin={() => begin(account)} paidToday={() => paidToday(account)} history={() => loadHistory(account)} />)}
    </section>

    {form && <PaymentModal form={form} accounts={data.students} setForm={setForm} error={error} saving={Boolean(savingId)} close={() => { setForm(null); setError(""); }} submit={submit} />}
    {historyAccount && <HistoryModal account={historyAccount} payments={history} loading={historyLoading} savingId={savingId} close={() => setHistoryAccount(null)} edit={editPayment} voidPayment={voidPayment} />}
    <TrainerFloatingActions mode="direct" enabled={!form && !historyAccount} actions={[{ label: "Registrar pago", symbol: "+", onSelect: () => begin() }]} />
  </ModuleShell>;
}

function MiniSummary({ label, value, tone, icon, ready }: { label: string; value: string | number; tone: string; icon: PaymentIconName; ready: boolean }) {
  return <div className="flex min-h-20 items-center justify-between rounded-xl border border-zinc-800 bg-black/25 px-3.5 py-3"><div><p className="text-xs text-zinc-500">{label}</p>{ready ? <p className={`mt-1 text-xl font-bold ${tone}`}>{value}</p> : <span className="mt-1 block h-5 w-12 animate-pulse rounded bg-zinc-800" />}</div><span className={`${tone} opacity-70`}><PaymentIcon name={icon} /></span></div>;
}

function AccountRow({ account, expanded, saving, toggle, begin, paidToday, history }: { account: PaymentStudentAccount; expanded: boolean; saving: boolean; toggle: () => void; begin: () => void; paidToday: () => void; history: () => void }) {
  const status = statusDetails[account.status];
  const canMessage = Boolean(account.phone) && (account.status === "VENCIDA" || account.status === "VENCE_PRONTO");
  return <article className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-lg shadow-black/10">
    <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${statusAccent[account.status]}`} />
    <div className="flex items-center gap-2 p-3 pl-4 sm:gap-3 sm:p-4 sm:pl-5">
      <button onClick={toggle} aria-expanded={expanded} className="grid min-w-0 flex-1 grid-cols-[auto_minmax(0,1fr)] items-center gap-3 text-left sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-zinc-700 bg-black/30 text-sm font-bold text-yellow-300">{initials(account.student)}</span>
        <span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><strong className="text-sm leading-tight text-white sm:text-base">{account.student}</strong><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 sm:hidden ${status.className}`}>{status.label}</span></span><span className="mt-1 block text-xs leading-relaxed text-zinc-400">{account.plan || "Sin plan"} · {money(account.monthlyFee)}</span><span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500">Vence: {showDate(account.nextDueDate)}{account.lastPaymentDate ? ` · Último: ${showDate(account.lastPaymentDate)}` : " · Sin pagos"}</span></span>
        <span className="hidden min-w-24 text-right sm:block"><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ring-1 ${status.className}`}>{status.label}</span><strong className="mt-2 block whitespace-nowrap text-sm text-white">{money(account.monthlyFee)}</strong></span>
      </button>
      <AccountActions account={account} saving={saving} canMessage={canMessage} begin={begin} paidToday={paidToday} history={history} />
    </div>
    {expanded && <div className="grid gap-3 border-t border-zinc-800 bg-black/25 p-4 text-sm sm:grid-cols-4"><Info label="Cuota mensual" value={money(account.monthlyFee)} /><Info label="Próximo vencimiento" value={showDate(account.nextDueDate)} /><Info label="Último pago" value={showDate(account.lastPaymentDate)} /><Info label="Importe último pago" value={account.lastPaymentAmount === null ? "Sin pagos" : money(account.lastPaymentAmount)} /><div className="flex flex-wrap gap-2 sm:col-span-4"><button onClick={begin} className="min-h-10 rounded-lg border border-yellow-400/40 px-3 text-xs font-bold text-yellow-300">Agregar pago</button><button onClick={history} className="min-h-10 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-zinc-300">Ver historial</button></div></div>}
  </article>;
}

function AccountActions({ account, saving, canMessage, begin, paidToday, history }: { account: PaymentStudentAccount; saving: boolean; canMessage: boolean; begin: () => void; paidToday: () => void; history: () => void }) {
  const [open, setOpen] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  function close(restoreFocus = true) {
    setOpen(false);
    if (restoreFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }
  function show() {
    const isMobile = window.innerWidth < 640;
    setMobile(isMobile);
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect && !isMobile) {
      const width = 224;
      const estimatedHeight = canMessage ? 238 : 194;
      const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
      const top = window.innerHeight - rect.bottom >= estimatedHeight + 12
        ? rect.bottom + 8
        : Math.max(12, rect.top - estimatedHeight - 8);
      setPosition({ top, left });
    }
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("keydown", handleKey);
    requestAnimationFrame(() => menuRef.current?.querySelector<HTMLElement>("button, a")?.focus());
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);
  const run = (action: () => void) => {
    close(false);
    action();
  };
  return <>
    <button ref={triggerRef} type="button" aria-label={`Acciones de ${account.student}`} aria-haspopup="menu" aria-expanded={open} onClick={() => open ? close() : show()} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-zinc-700/80 bg-black/25 text-xl text-zinc-400 transition hover:border-yellow-400/30 hover:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400">⋮</button>
    {open && createPortal(<div className="fixed inset-0 z-[100]" onPointerDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <div ref={menuRef} role="menu" aria-label={`Acciones de ${account.student}`} style={mobile ? { left: 12, right: 12, bottom: "calc(env(safe-area-inset-bottom) + 12px)" } : { top: position.top, left: position.left }} className="fixed h-auto max-h-[calc(100dvh-24px)] w-56 overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-1.5 text-sm text-white shadow-2xl max-sm:w-auto max-sm:rounded-t-2xl">
        <p className="hidden px-3 py-2 text-xs font-semibold text-zinc-500 max-sm:block">{account.student}</p>
        <button role="menuitem" onClick={() => run(begin)} className="block w-full rounded-lg px-3 py-3 text-left hover:bg-zinc-800">Agregar pago</button>
        <button role="menuitem" onClick={() => run(paidToday)} disabled={saving || account.monthlyFee <= 0} className="block w-full rounded-lg px-3 py-3 text-left hover:bg-zinc-800 disabled:opacity-40">Pagó hoy</button>
        <button role="menuitem" onClick={() => run(history)} className="block w-full rounded-lg px-3 py-3 text-left hover:bg-zinc-800">Ver historial</button>
        <Link role="menuitem" onClick={() => close(false)} href={`/alumnos?buscar=${encodeURIComponent(account.student)}`} className="block rounded-lg px-3 py-3 hover:bg-zinc-800">Editar configuración de pago</Link>
        {canMessage && <a role="menuitem" onClick={() => close(false)} href={whatsappUrl(account)} target="_blank" rel="noreferrer" className="block rounded-lg px-3 py-3 text-emerald-300 hover:bg-zinc-800">Abrir WhatsApp</a>}
      </div>
    </div>, document.body)}
  </>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[11px] text-zinc-500">{label}</p><p className="mt-0.5 font-semibold text-zinc-100">{value}</p></div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

type PaymentIconName = "summary" | "trend" | "overdue" | "calendar" | "check" | "student" | "wallet" | "search";

function PaymentIcon({ name }: { name: PaymentIconName }) {
  const paths: Record<PaymentIconName, ReactNode> = {
    summary: <><path d="M12 3a9 9 0 1 0 9 9h-9Z"/><path d="M12 3v9h9"/></>,
    trend: <><path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/></>,
    overdue: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
    check: <><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></>,
    student: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
    wallet: <><path d="M4 6h15a2 2 0 0 1 2 2v11H4a2 2 0 0 1-2-2V6a3 3 0 0 1 3-3h13"/><path d="M16 11h5v4h-5a2 2 0 0 1 0-4Z"/></>,
    search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">{paths[name]}</svg>;
}

function StudentCombobox({ form, accounts, setForm, disabled, inputRef, onSelected }: { form: PaymentForm; accounts: PaymentStudentAccount[]; setForm: (form: PaymentForm) => void; disabled: boolean; inputRef: RefObject<HTMLInputElement | null>; onSelected: () => void }) {
  const selected = accounts.find((account) => account.studentId === form.studentId);
  const [query, setQuery] = useState(selected?.student ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const normalized = query.trim().toLocaleLowerCase("es");
  const results = accounts.filter((account) => !normalized || `${account.student} ${account.phone}`.toLocaleLowerCase("es").includes(normalized)).slice(0, 10);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", closeOutside);
    return () => document.removeEventListener("pointerdown", closeOutside);
  }, []);
  function choose(account: PaymentStudentAccount) {
    setQuery(account.student);
    setOpen(false);
    setActiveIndex(0);
    setForm({
      ...form,
      studentId: account.studentId,
      amount: account.monthlyFee,
      dueDate: addMonthsToDateKey(account.nextDueDate || form.paidDate),
    });
    requestAnimationFrame(onSelected);
  }
  function clear() {
    setQuery("");
    setOpen(true);
    setActiveIndex(0);
    setForm({ ...form, studentId: "", amount: 0, dueDate: "" });
  }
  return <div ref={rootRef} className="relative sm:col-span-2">
    <label htmlFor="payment-student-search" className="text-sm">Alumno</label>
    <div className="relative mt-1">
      <input ref={inputRef} id="payment-student-search" data-enter-next="false" role="combobox" aria-expanded={open} aria-controls="payment-student-options" aria-autocomplete="list" aria-activedescendant={open && results[activeIndex] ? `payment-student-${results[activeIndex].studentId}` : undefined} disabled={disabled} value={query} onFocus={() => !disabled && setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActiveIndex(0); if (form.studentId) setForm({ ...form, studentId: "" }); }} onKeyDown={(event) => {
        if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, results.length - 1)); }
        if (event.key === "ArrowUp") { event.preventDefault(); setActiveIndex((index) => Math.max(index - 1, 0)); }
        if (event.key === "Enter" && open && results[activeIndex]) { event.preventDefault(); choose(results[activeIndex]); }
        if (event.key === "Escape") setOpen(false);
      }} placeholder="Buscar por nombre, apellido o teléfono" className={`${inputClass} pr-20`} />
      {!disabled && query && <button type="button" onClick={clear} aria-label="Limpiar alumno seleccionado" className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-800">Limpiar</button>}
    </div>
    {selected && <p className="mt-2 text-xs text-yellow-200">Alumno elegido: <strong>{selected.student}</strong></p>}
    {open && !disabled && <div id="payment-student-options" role="listbox" className="absolute z-[110] mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-1.5 shadow-2xl">
      {results.length ? results.map((account, index) => <button id={`payment-student-${account.studentId}`} role="option" aria-selected={account.studentId === form.studentId} key={account.studentId} type="button" onPointerMove={() => setActiveIndex(index)} onClick={() => choose(account)} className={`block w-full rounded-lg px-3 py-3 text-left ${index === activeIndex || account.studentId === form.studentId ? "bg-yellow-400/10 text-yellow-100" : "text-zinc-200 hover:bg-zinc-800"}`}><span className="block font-semibold">{account.student}</span><span className="mt-0.5 block text-xs text-zinc-500">{account.phone || "Sin teléfono"} · {account.plan || "Sin plan"}</span></button>) : <p className="p-4 text-center text-sm text-zinc-500">No se encontraron alumnos.</p>}
    </div>}
  </div>;
}

function PaymentModal({ form, accounts, setForm, error, saving, close, submit }: { form: PaymentForm; accounts: PaymentStudentAccount[]; setForm: (form: PaymentForm) => void; error: string; saving: boolean; close: () => void; submit: (event: FormEvent<HTMLFormElement>) => void }) {
  const account = accounts.find((item) => item.studentId === form.studentId);
  const title = form.mode === "edit" ? "Editar pago" : form.mode === "quick" ? "Confirmar “Pagó hoy”" : "Agregar pago";
  const formRef = useRef<HTMLFormElement>(null);
  const studentInputRef = useRef<HTMLInputElement>(null);
  const handleEnterNavigation = useEnterFieldNavigation();
  useEscapeLayer(true, close, { priority: 80 });
  useEffect(() => {
    requestAnimationFrame(() => {
      if (!form.studentId) studentInputRef.current?.focus();
      else formRef.current?.querySelector<HTMLInputElement>('input[name="payment-amount"]')?.focus();
    });
  }, [form.studentId]);
  function focusAmount() { formRef.current?.querySelector<HTMLInputElement>('input[name="payment-amount"]')?.focus(); }
  return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-3"><form ref={formRef} onSubmit={submit} onKeyDownCapture={handleEnterNavigation} role="dialog" aria-modal="true" aria-labelledby="payment-modal-title" className="mx-auto my-4 w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-white shadow-2xl sm:my-10">
    <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-yellow-400">{title}</p><h2 id="payment-modal-title" className="mt-1 text-lg font-bold">{account?.student ?? "Seleccioná un alumno"}</h2>{form.mode === "quick" && <p className="mt-1 text-xs text-zinc-400">Revisá importe y fecha antes de confirmar.</p>}</div><button type="button" onClick={close} disabled={saving} className="p-2 text-zinc-400">Cerrar</button></div>
    {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-2">
      <StudentCombobox form={form} accounts={accounts} setForm={setForm} disabled={form.mode === "edit"} inputRef={studentInputRef} onSelected={focusAmount} />
      <label className="text-sm">Importe<input name="payment-amount" required type="number" min="1" step="0.01" inputMode="decimal" value={form.amount || ""} onChange={(event) => setForm({ ...form, amount: Number(event.target.value) })} className={`${inputClass} mt-1`} /></label>
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
