"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { BmFilterIcon } from "@/componentes/icons";
import { inputClass } from "@/componentes/module-shell";
import { argentinaDateKey } from "@/lib/payment-dates";
import { CLASS_RATINGS } from "@/lib/class-communication";

type Report = { total: number; distribution: Record<string, number>; commentTotal: number; page: number; pages: number; comments: { id: string; className: string; date: string; startTime: string; rating: string; comment: string }[] };
export function ClassOpinionsPanel() {
  const [open, setOpen] = useState(false);
  const details = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("opiniones") === "hoy" || window.location.hash === "#opiniones") {
      if (details.current) { details.current.open = true; details.current.scrollIntoView?.({ block: "start" }); }
    }
  }, []);
  return <details id="opiniones" ref={details} className="bm-surface my-5 rounded-2xl border border-zinc-800 px-3 py-2 sm:px-4" onToggle={event => setOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-2 text-sm font-bold leading-7 text-[var(--brand-text)]">Opiniones</summary>{open && <OpinionsContent/>}</details>;
}
function useReport(request: string) {
  const [result, setResult] = useState<{ query: string; data: Report } | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/clases/opiniones?${request}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "No se pudieron cargar las opiniones."); return body as Report;
    }).then(data => { if (!controller.signal.aborted) { setResult({ query: request, data }); setError(""); } }).catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudieron cargar las opiniones."); });
    return () => controller.abort();
  }, [request, retry]);
  return { data: result?.query === request ? result.data : null, error, retry: () => { setError(""); setRetry(value => value + 1); } };
}
function OpinionsContent() {
  const today = argentinaDateKey();
  const [from, setFrom] = useState(today.slice(0, 7) + "-01"), [to, setTo] = useState(today), [q, setQuery] = useState("");
  const [receivedOn, setReceivedOn] = useState(() => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("opiniones") === "hoy" ? today : "");
  const [request, setRequest] = useState(() => new URLSearchParams({ from, to, ...(receivedOn ? { receivedOn } : {}) }).toString());
  const { data, error, retry } = useReport(request);
  function apply(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setReceivedOn(""); setRequest(new URLSearchParams({ from, to, class: q }).toString()); }
  function go(page: number) { const params = new URLSearchParams(request); params.set("page", String(page)); setRequest(params.toString()); }
  return <div className="pb-2 pt-1"><form onSubmit={apply} className="grid grid-cols-2 items-end gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.5fr)]"><label className="min-w-0 text-xs text-[var(--foreground-muted)]">Desde<input required type="date" value={from} onChange={event => setFrom(event.target.value)} className={`${inputClass} mt-1 min-w-0`}/></label><label className="min-w-0 text-xs text-[var(--foreground-muted)]">Hasta<input required type="date" min={from} value={to} onChange={event => setTo(event.target.value)} className={`${inputClass} mt-1 min-w-0`}/></label><div className="col-span-2 flex min-w-0 items-end gap-2 md:col-span-1"><label className="min-w-0 flex-1 text-xs text-[var(--foreground-muted)]">Clase<input type="search" maxLength={120} placeholder="Nombre de la clase" value={q} onChange={event => setQuery(event.target.value)} className={`${inputClass} mt-1 min-w-0`}/></label><button type="submit" aria-label="Aplicar filtros" title="Aplicar filtros" className="grid size-11 shrink-0 place-items-center rounded-xl border border-[var(--input-border)] bg-[var(--input-bg)] text-[var(--foreground-muted)] transition hover:text-[var(--brand-text)] focus-visible:outline-2 focus-visible:outline-[var(--brand-text)]"><BmFilterIcon size={18}/></button></div></form>
    {receivedOn && <p className="mt-2 text-xs text-[var(--foreground-muted)]">Opiniones recibidas hoy, incluidas clases anteriores. Aplicar fechas vuelve al filtro por fecha de clase.</p>}
    {error ? <ReportError message={error} retry={retry}/> : !data ? <p role="status" className="py-4 text-sm text-[var(--foreground-muted)]">Cargando opiniones…</p> : <>
      <p className="mt-3 text-xs text-[var(--foreground-muted)]">{data.total} valoraciones del período</p>
      <div aria-label="Resumen de valoraciones" className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">{CLASS_RATINGS.map(rating => <span key={rating.value} className="text-[var(--foreground)]">{rating.label}: <strong>{data.distribution[rating.value] ?? 0}</strong></span>)}</div>
      <p className="mt-2 text-xs text-[var(--foreground-muted)]">Comentarios privados. Los registros conservan su asociación con cada alumno.</p>
      <section aria-label="Comentarios para mejorar" className="mt-4"><h3 className="text-sm font-semibold text-[var(--foreground)]">Comentarios para mejorar</h3><CommentList data={data} positive={false} go={go}/></section>
      <OtherComments key={request} query={request}/>
    </>}
  </div>;
}
function ReportError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="mt-3 text-sm text-red-400"><p>{message}</p><button type="button" onClick={retry} className="min-h-11 font-semibold">Reintentar</button></div>;
}
function OtherComments({ query }: { query: string }) {
  const [open, setOpen] = useState(false);
  return <details className="mt-3 border-t border-[var(--input-border)] pt-1" onToggle={event => setOpen(event.currentTarget.open)}><summary className="min-h-11 cursor-pointer py-3 text-xs font-semibold text-[var(--brand-text)]">Ver otros comentarios</summary>{open && <PositiveComments query={query}/>}</details>;
}
function PositiveComments({ query }: { query: string }) {
  const [request, setRequest] = useState(() => { const params = new URLSearchParams(query); params.set("comments", "positive"); params.delete("page"); return params.toString(); });
  const { data, error, retry } = useReport(request);
  function go(page: number) { const params = new URLSearchParams(request); params.set("page", String(page)); setRequest(params.toString()); }
  return error ? <ReportError message={error} retry={retry}/> : !data ? <p role="status" className="py-3 text-xs text-[var(--foreground-muted)]">Cargando comentarios…</p> : <CommentList data={data} positive go={go}/>;
}
function CommentList({ data, positive, go }: { data: Report; positive: boolean; go: (page: number) => void }) {
  return <>{data.comments.length ? <><p className="mt-1 text-xs text-[var(--foreground-muted)]">{data.commentTotal} comentarios · 30 por página</p><ul className="mt-1 divide-y divide-[var(--input-border)]">{data.comments.map(comment => <li key={comment.id} className="py-3"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--foreground)]">{comment.comment}</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">{comment.className} · {new Date(comment.date + "T12:00:00Z").toLocaleDateString("es-AR", { timeZone: "UTC" })} · {comment.startTime}{positive ? ` · ${CLASS_RATINGS.find(rating => rating.value === comment.rating)?.label ?? ""}` : ""}</p></li>)}</ul></> : <p role="status" className="py-3 text-xs text-[var(--foreground-muted)]">{positive ? "Sin otros comentarios para estos filtros." : "Sin comentarios para mejorar en este período."}</p>}
    {data.pages > 1 && <nav aria-label={positive ? "Páginas de otros comentarios" : "Páginas de comentarios para mejorar"} className="mt-2 flex items-center justify-between gap-3"><button type="button" disabled={data.page <= 1} onClick={() => go(data.page - 1)} className="min-h-11 rounded-xl border border-[var(--input-border)] px-3 text-xs disabled:opacity-40">Anterior</button><span className="text-xs text-[var(--foreground-muted)]">{data.page} / {data.pages}</span><button type="button" disabled={data.page >= data.pages} onClick={() => go(data.page + 1)} className="min-h-11 rounded-xl border border-[var(--input-border)] px-3 text-xs disabled:opacity-40">Siguiente</button></nav>}
  </>;
}
