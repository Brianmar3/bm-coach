"use client";
import { useEffect, useState, useRef } from "react";
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
    }).then(data => { if (!controller.signal.aborted) { setResult(previous => ({ query: request, data: { ...data, comments: data.page > 1 && previous ? [...previous.data.comments, ...data.comments.filter(comment => !previous.data.comments.some(item => item.id === comment.id))] : data.comments } })); setError(""); } }).catch((failure: unknown) => { if (!controller.signal.aborted) setError(failure instanceof Error ? failure.message : "No se pudieron cargar las opiniones."); });
    return () => controller.abort();
  }, [request, retry]);
  return { data: result?.data ?? null, loading: result?.query !== request, error, retry: () => { setError(""); setRetry(value => value + 1); } };
}
function OpinionsContent() {
  const [today] = useState(() => argentinaDateKey());
  const [page, setPage] = useState(1);
  const request = new URLSearchParams({ from: "1970-01-01", to: today, comments: "improve", page: String(page) }).toString();
  const { data, loading, error, retry } = useReport(request);
  return <div className="pb-2 pt-1">
    {!data && !error && <p role="status" className="py-4 text-sm text-[var(--foreground-muted)]">Cargando opiniones…</p>}
    {data && <>
      <div aria-label="Resumen de valoraciones" className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{CLASS_RATINGS.map(rating => <span key={rating.value} className="text-[var(--foreground)]">{rating.label}: <strong>{data.distribution[rating.value] ?? 0}</strong></span>)}</div>
      <section aria-label="Comentarios para mejorar" className="mt-3">
        {data.comments.some(comment => comment.rating === "IMPROVE" && comment.comment.trim()) ? <ul aria-label="Comentarios A mejorar" tabIndex={0} className="max-h-80 overflow-y-auto overscroll-contain divide-y divide-[var(--input-border)]" onScroll={event => {
          const list = event.currentTarget;
          if (!loading && !error && data.page < data.pages && list.scrollHeight - list.scrollTop - list.clientHeight < 80) setPage(data.page + 1);
        }}>{data.comments.filter(comment => comment.rating === "IMPROVE" && comment.comment.trim()).map(comment => <li key={comment.id} className="py-3"><p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--foreground)]">{comment.comment}</p><p className="mt-1 text-xs text-[var(--foreground-muted)]">{comment.className} · {new Date(comment.date + "T12:00:00Z").toLocaleDateString("es-AR", { timeZone: "UTC" })} · {comment.startTime}</p></li>)}</ul> : <p role="status" className="py-3 text-xs text-[var(--foreground-muted)]">No hay comentarios para mejorar por el momento</p>}
      </section>
    </>}
    {error && <ReportError message={error} retry={retry}/>}
    {data && loading && !error && <p role="status" className="py-2 text-xs text-[var(--foreground-muted)]">Cargando comentarios…</p>}
  </div>;
}

function ReportError({ message, retry }: { message: string; retry: () => void }) {
  return <div role="alert" className="mt-3 text-sm text-red-400"><p>{message}</p><button type="button" onClick={retry} className="min-h-11 font-semibold">Reintentar</button></div>;
}
