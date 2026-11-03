"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { BmFilterIcon } from "@/componentes/icons";
import { inputClass } from "@/componentes/module-shell";
import { argentinaDateKey } from "@/lib/payment-dates";
import { CLASS_RATINGS } from "@/lib/class-communication";

type Report = { total: number; page: number; pages: number; classes: { id: string; className: string; date: string; startTime: string; count: number; distribution: Record<string, number>; opinions: { id: string; studentName: string; rating: string; comment: string }[] }[] };
export function ClassOpinionsPanel() {
  const [open, setOpen] = useState(false);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("opiniones") === "hoy" || window.location.hash === "#opiniones") {
      if (details.current) { details.current.open = true; details.current.scrollIntoView?.({ block: "start" }); }
    }
  }, []);
  return <details id="opiniones" ref={details} className="bm-surface my-5 rounded-2xl border border-zinc-800 px-3 py-2 sm:px-4" onToggle={event => setOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold leading-7 text-yellow-300">Opiniones</summary>{open && <OpinionsContent/>}</details>;
}
function OpinionsContent() {
  const today = argentinaDateKey();
  const [from, setFrom] = useState(today.slice(0, 7) + "-01"); const [to, setTo] = useState(today); const [q, setQuery] = useState("");
  const [quick, setQuick] = useState("all");
  const [receivedOn, setReceivedOn] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("opiniones") === "hoy" ? today : "");
  const [request, setRequest] = useState(() => new URLSearchParams({ from, to, ...(receivedOn ? { receivedOn } : {}) }).toString());
  const [result, setResult] = useState<{ query: string; data: Report } | null>(null); const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/clases/opiniones?${request}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las opiniones."); return body as Report;
    }).then(data => { if (!controller.signal.aborted) { setResult({ query: request, data }); setError(""); } }).catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudieron cargar las opiniones."); });
    return () => controller.abort();
  }, [request, retry]);
  function apply(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setReceivedOn(""); setRequest(new URLSearchParams({ from, to, class: q, quick }).toString()); }
  function go(page: number) { const params = new URLSearchParams(request); params.set("page", String(page)); setError(""); setRequest(params.toString()); }
  function quickFilter(value: string) { setQuick(value); const params = new URLSearchParams(request); params.set("quick", value); params.delete("page"); setError(""); setRequest(params.toString()); }
  const data = result?.query === request ? result.data : null;
  return <div className="pb-2 pt-1"><form onSubmit={apply} className="grid grid-cols-2 items-end gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)]"><label className="min-w-0 text-xs text-zinc-400">Desde<input required type="date" value={from} onChange={event => setFrom(event.target.value)} className={`${inputClass} mt-1 min-w-0`}/></label><label className="min-w-0 text-xs text-zinc-400">Hasta<input required type="date" min={from} value={to} onChange={event => setTo(event.target.value)} className={`${inputClass} mt-1 min-w-0`}/></label><div className="col-span-2 flex min-w-0 items-end gap-2 md:col-span-1"><label className="min-w-0 flex-1 text-xs text-zinc-400">Clase<input type="search" maxLength={120} placeholder="Nombre de la clase" value={q} onChange={event => setQuery(event.target.value)} className={`${inputClass} mt-1 min-w-0`}/></label><button type="submit" aria-label="Aplicar filtros" title="Aplicar filtros" className="grid size-11 shrink-0 place-items-center rounded-xl border border-zinc-700 bg-zinc-950 text-zinc-300 transition hover:border-yellow-400/60 hover:text-yellow-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300"><BmFilterIcon size={18}/></button></div></form>
    <div role="group" aria-label="Filtrar opiniones" className="mt-2 flex flex-wrap gap-1">{[["all", "Todas"], ["improve", "A mejorar"], ["comments", "Con comentarios"]].map(([value, label]) => <button key={value} type="button" aria-pressed={quick === value} onClick={() => quickFilter(value)} className={"min-h-11 rounded-lg px-3 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-yellow-300 " + (quick === value ? "bg-yellow-400/10 text-yellow-300" : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200")}>{label}</button>)}</div>
    {receivedOn && <p className="mt-2 text-sm text-zinc-400">Opiniones recibidas hoy, incluidas clases anteriores. Aplicar fechas vuelve al filtro por fecha de clase.</p>}
    {error ? <div role="alert" className="mt-3 text-sm text-red-300"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 font-bold">Reintentar</button></div> : !data ? <p role="status" className="py-4 text-sm text-zinc-400">Cargando opiniones…</p> : <>
      <p className="mt-2 text-xs text-zinc-400">{data.total} respuestas · Privadas e identificadas · 30 opiniones por página</p>
      {data.classes.length ? <div className="mt-3 divide-y divide-[var(--input-border)]">{data.classes.map(item => <section key={item.id} className="py-2 first:pt-0 last:pb-0" aria-label={item.className}>
        <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs"><h3 className="font-semibold text-[var(--foreground)]">{item.className}</h3><span className="text-[var(--foreground-muted)]">{item.count} respuestas</span><div className="flex flex-wrap gap-x-3 gap-y-1 text-[var(--foreground-muted)]">{CLASS_RATINGS.map(rating => <span key={rating.value}>{rating.label}: {item.distribution[rating.value] ?? 0}</span>)}</div></div>
        <ul className="divide-y divide-[var(--input-border)]">{item.opinions.map(opinion => {
          const row = <><span className="min-w-0"><span className="block break-words text-sm font-semibold text-[var(--foreground)]">{opinion.studentName}</span><span className="mt-0.5 block text-xs text-[var(--foreground-muted)]">{new Date(item.date + "T12:00:00Z").toLocaleDateString("es-AR", { timeZone: "UTC" })} · {item.startTime}</span></span><span className="flex shrink-0 items-center gap-2 text-xs font-medium text-[var(--brand-text)]"><span>{CLASS_RATINGS.find(rating => rating.value === opinion.rating)?.label}</span>{opinion.comment && <span aria-label="Con comentario">💬</span>}</span></>;
          const rowClass = "grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-2";
          return <li key={request + opinion.id}>{opinion.comment ? <details className="group"><summary className={rowClass + " cursor-pointer list-none rounded-md transition hover:bg-[var(--input-bg)] focus-visible:outline-2 focus-visible:outline-[var(--brand-text)] [&::-webkit-details-marker]:hidden"}>{row}</summary><p className="pb-3 text-sm leading-relaxed whitespace-pre-wrap break-words text-[var(--foreground-muted)]">{opinion.comment}</p></details> : <div className={rowClass}>{row}</div>}</li>;
        })}</ul>
      </section>)}</div> : <p role="status" className="py-5 text-sm text-zinc-400">Todavía no hay opiniones para estos filtros.</p>}
      {data.pages > 1 && <nav aria-label="Páginas de opiniones" className="mt-4 flex items-center justify-between gap-3"><button type="button" disabled={data.page <= 1} onClick={() => go(data.page - 1)} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-sm disabled:opacity-40">Anterior</button><span className="text-sm">{data.page} / {data.pages}</span><button type="button" disabled={data.page >= data.pages} onClick={() => go(data.page + 1)} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-sm disabled:opacity-40">Siguiente</button></nav>}
    </>}
  </div>;
}
