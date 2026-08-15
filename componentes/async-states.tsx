"use client";

import type { ReactNode } from "react";

export function ErrorState({ title, description, retry, compact = false }: { title: string; description?: string; retry: () => void; compact?: boolean }) {
  return <section role="alert" className={`rounded-2xl border border-red-400/25 bg-red-400/[.06] text-center ${compact ? "p-4" : "p-6"}`}><span aria-hidden="true" className="text-lg text-red-300">△</span><h3 className="mt-1 font-bold text-zinc-100">{title}</h3>{description && <p className="mt-1 text-sm text-zinc-400">{description}</p>}<button type="button" onClick={retry} className="mt-4 min-h-11 rounded-xl border border-red-300/35 px-4 text-sm font-bold text-red-200 transition hover:bg-red-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300">Reintentar</button></section>;
}

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <section className="rounded-2xl border border-dashed border-zinc-700 bg-black/20 p-5 text-center"><span aria-hidden="true" className="text-lg text-zinc-600">◇</span><h3 className="mt-1 text-sm font-bold text-zinc-300">{title}</h3>{description && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{description}</p>}{action && <div className="mt-3">{action}</div>}</section>;
}

export function CardGridSkeleton({ cards = 4 }: { cards?: number }) {
  return <div aria-hidden="true" className="grid animate-pulse grid-cols-2 gap-2 lg:grid-cols-4">{Array.from({ length: cards }, (_, index) => <div key={index} className="h-24 rounded-2xl border border-zinc-800 bg-zinc-900"><div className="m-4 h-3 w-2/3 rounded bg-zinc-800" /><div className="mx-4 mt-3 h-6 w-1/3 rounded bg-zinc-800" /></div>)}</div>;
}

export function ListSkeleton({ rows = 5, cardHeight = "h-20" }: { rows?: number; cardHeight?: string }) {
  return <div aria-hidden="true" className="animate-pulse space-y-2">{Array.from({ length: rows }, (_, index) => <div key={index} className={`${cardHeight} rounded-xl border border-zinc-800 bg-zinc-900/80 p-4`}><div className="h-3 w-1/3 rounded bg-zinc-800" /><div className="mt-3 h-3 w-2/3 rounded bg-zinc-800" /></div>)}</div>;
}
