"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { TransferPaymentDetails } from "@/types/gestion";
import type { PortalPaymentObligation } from "@/types/portal";
import { hasTransferDetails, openTransferObligations, transferCopyText } from "@/lib/transfer-payment";

const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
const period = (value: string) => new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));

export function PortalTransferPaymentSheet({ details, obligations }: { details: TransferPaymentDetails; obligations: PortalPaymentObligation[] }) {
  const openObligations = useMemo(() => openTransferObligations(obligations), [obligations]);
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(openObligations[0]?.id ?? "");
  const [copyStatus, setCopyStatus] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const selected = openObligations.find((obligation) => obligation.id === selectedId) ?? openObligations[0];
  const configured = hasTransferDetails(details);

  useEffect(() => {
    if (!open) return;
    const priorOverflow = document.body.style.overflow;
    const trigger = triggerRef.current;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = priorOverflow;
      trigger?.focus();
    };
  }, [open]);

  if (!openObligations.length) return null;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus(label === "Todos los datos" ? "Datos copiados." : label === "CBU / CVU" ? "CBU/CVU copiado." : `${label} copiado.`);
    } catch {
      setCopyStatus(`No pudimos copiar ${label.toLocaleLowerCase("es")}.`);
    }
  }

  function close() {
    setOpen(false);
    setCopyStatus("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab" || !sheetRef.current) return;
    const focusable = [...sheetRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), [href], [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return <>
    <button ref={triggerRef} type="button" onClick={() => { setSelectedId(openObligations[0]?.id ?? ""); setOpen(true); }} className="flex min-h-12 w-full items-center justify-between rounded-lg border border-yellow-400/20 bg-yellow-400/[.04] px-3 py-2.5 text-left text-sm font-semibold text-zinc-100 transition hover:border-yellow-400/40 hover:bg-yellow-400/[.07] focus:outline-none focus:ring-2 focus:ring-yellow-400">
      <span>Transferencia</span><span className="text-xs font-bold text-yellow-400">Ver datos →</span>
    </button>
    {open && selected && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }} onKeyDown={handleKeyDown} className="fixed inset-0 z-[80] flex items-end justify-center bg-black/75 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby="transfer-title" aria-describedby="transfer-description" className="max-h-[90dvh] w-full overflow-y-auto rounded-t-[26px] border border-white/10 bg-[#111] shadow-[0_-20px_60px_rgba(0,0,0,.55)] sm:max-w-lg sm:rounded-[26px]">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/[.07] bg-[#111]/95 px-4 py-4 backdrop-blur sm:px-5">
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-yellow-400">Pago por transferencia</p><h2 id="transfer-title" className="mt-1 text-xl font-black text-zinc-50">Datos para transferir</h2><p id="transfer-description" className="mt-1 text-xs text-zinc-500">Usá estos datos para realizar la transferencia desde tu banco o billetera.</p></div>
          <button ref={closeRef} type="button" onClick={close} aria-label="Cerrar datos de transferencia" className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-white/10 text-xl text-zinc-300 focus:outline-none focus:ring-2 focus:ring-yellow-400">×</button>
        </header>
        <div className="space-y-4 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">
          {openObligations.length > 1 && <label className="block text-xs font-semibold text-zinc-400">Cuota a consultar<select value={selected.id} onChange={(event) => { setSelectedId(event.target.value); setCopyStatus(""); }} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100 focus:outline-none focus:ring-2 focus:ring-yellow-400">{openObligations.map((obligation) => <option key={obligation.id} value={obligation.id}>{period(obligation.period)} · {money(obligation.balance)}</option>)}</select></label>}
          <section className="rounded-2xl border border-yellow-400/20 bg-[radial-gradient(circle_at_90%_10%,rgba(250,204,21,.08),transparent_36%),#0a0a0a] p-4">
            <p className="text-xs text-zinc-500">Importe pendiente · <span className="capitalize">{period(selected.period)}</span></p><p className="mt-1 text-3xl font-black tracking-tight text-zinc-50">{money(selected.balance)}</p>
            {selected.paidAmount > 0 && <p className="mt-2 text-xs text-zinc-500">Cuota {money(selected.expectedAmount)} · ya registrado {money(selected.paidAmount)}</p>}
          </section>
          {configured ? <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950"><TransferRow label="Titular" value={details.holder} onCopy={copy} /><TransferRow label="Alias" value={details.alias} onCopy={copy} /><TransferRow label="CBU / CVU" value={details.accountNumber} onCopy={copy} /><TransferRow label="Banco / billetera" value={details.institution} onCopy={copy} /></section> : <div className="rounded-2xl border border-amber-400/20 bg-amber-400/[.05] p-4"><p className="font-semibold text-amber-100">Datos de transferencia no disponibles</p><p className="mt-1 text-sm text-zinc-400">Consultá con tu entrenador para recibir los datos correctos.</p></div>}
          {configured && <button type="button" onClick={() => copy(transferCopyText(details, selected.balance), "Todos los datos")} className="min-h-12 w-full rounded-xl border border-yellow-400/30 px-4 py-3 text-sm font-bold text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400">Copiar todos los datos</button>}
          <p aria-live="polite" className="min-h-5 text-center text-xs font-semibold text-emerald-300">{copyStatus}</p>
          <p className="rounded-xl bg-zinc-950 px-3 py-2.5 text-xs leading-relaxed text-zinc-500">Este panel es únicamente informativo. El pago queda confirmado cuando tu entrenador lo registra en BM Training.</p>
        </div>
      </div>
    </div>}
  </>;
}

function TransferRow({ label, value, onCopy }: { label: string; value: string; onCopy: (value: string, label: string) => void }) {
  if (!value) return null;
  return <div className="flex min-h-16 items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 last:border-b-0"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600">{label}</p><p className="mt-1 break-all text-sm font-semibold text-zinc-200">{value}</p></div><button type="button" onClick={() => onCopy(value, label)} className="min-h-11 shrink-0 rounded-lg border border-zinc-700 px-3 text-xs font-bold text-yellow-400 focus:outline-none focus:ring-2 focus:ring-yellow-400">Copiar</button></div>;
}
