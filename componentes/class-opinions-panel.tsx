"use client";
import { useEffect, useState, type FormEvent } from "react";
import { inputClass } from "@/componentes/module-shell";
import { argentinaDateKey } from "@/lib/payment-dates";
import { CLASS_RATINGS } from "@/lib/class-communication";

type Report = { total: number; page: number; pages: number; classes: { id: string; className: string; date: string; startTime: string; count: number; distribution: Record<string, number>; opinions: { id: string; studentName: string; rating: string; comment: string }[] }[] };
export function ClassOpinionsPanel() {
  const [open, setOpen] = useState(false);
  return <details className="bm-surface mt-5 rounded-2xl border border-zinc-800 p-4" onToggle={event => setOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer font-bold text-yellow-300">Opiniones</summary>{open && <OpinionsContent/>}</details>;
}
function OpinionsContent() {
  const today = argentinaDateKey();
  const [from, setFrom] = useState(today.slice(0, 7) + "-01"); const [to, setTo] = useState(today); const [q, setQuery] = useState("");
  const [request, setRequest] = useState(() => new URLSearchParams({ from, to }).toString());
  const [result, setResult] = useState<{ query: string; data: Report } | null>(null); const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/clases/opiniones?${request}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las opiniones."); return body as Report;
    }).then(data => { if (!controller.signal.aborted) { setResult({ query: request, data }); setError(""); } }).catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudieron cargar las opiniones."); });
    return () => controller.abort();
  }, [request, retry]);
  function apply(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(""); setRequest(new URLSearchParams({ from, to, class: q }).toString()); }
  function go(page: number) { const params = new URLSearchParams(request); params.set("page", String(page)); setError(""); setRequest(params.toString()); }
  const data = result?.query === request ? result.data : null;
  return <div className="mt-3"><form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm">Desde<input required type="date" value={from} onChange={event => setFrom(event.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-sm">Hasta<input required type="date" min={from} value={to} onChange={event => setTo(event.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-sm">Clase<input type="search" maxLength={120} placeholder="Nombre de la clase" value={q} onChange={event => setQuery(event.target.value)} className={`${inputClass} mt-1`}/></label><button type="submit" className="min-h-11 self-end rounded-xl bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-950">Aplicar filtros</button></form>
    {error ? <div role="alert" className="mt-3 text-sm text-red-300"><p>{error}</p><button type="button" onClick={() => setRetry(value => value + 1)} className="min-h-11 font-bold">Reintentar</button></div> : !data ? <p role="status" className="py-4 text-sm text-zinc-400">Cargando opiniones…</p> : <>
      <p className="mt-4 text-sm text-zinc-400">{data.total} respuestas · Privadas e identificadas · 30 opiniones por página</p>
      {data.classes.length ? data.classes.map(item => <article key={item.id} className="mt-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4"><h3 className="font-bold">{item.className} · {new Date(item.date + "T12:00:00Z").toLocaleDateString("es-AR", { timeZone: "UTC" })} · {item.startTime}</h3><p className="mt-1 text-sm text-zinc-400">{item.count} respuestas en esta clase</p><div className="mt-2 flex flex-wrap gap-3 text-sm">{CLASS_RATINGS.map(rating => <span key={rating.value}>{rating.label}: {item.distribution[rating.value] ?? 0}</span>)}</div><ul className="mt-3 divide-y divide-zinc-800">{item.opinions.map(opinion => <li key={opinion.id} className="py-3 text-sm"><p className="font-semibold text-yellow-300">{opinion.studentName} · {CLASS_RATINGS.find(rating => rating.value === opinion.rating)?.label}</p>{opinion.comment && <p className="mt-1 whitespace-pre-wrap break-words text-zinc-300">{opinion.comment}</p>}</li>)}</ul></article>) : <p role="status" className="py-5 text-sm text-zinc-400">Todavía no hay opiniones para estos filtros.</p>}
      {data.pages > 1 && <nav aria-label="Páginas de opiniones" className="mt-4 flex items-center justify-between gap-3"><button type="button" disabled={data.page <= 1} onClick={() => go(data.page - 1)} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-sm disabled:opacity-40">Anterior</button><span className="text-sm">{data.page} / {data.pages}</span><button type="button" disabled={data.page >= data.pages} onClick={() => go(data.page + 1)} className="min-h-11 rounded-xl border border-zinc-700 px-3 text-sm disabled:opacity-40">Siguiente</button></nav>}
    </>}
  </div>;
}
