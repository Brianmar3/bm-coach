"use client";

import { useEffect, useState } from "react";

type Diagnostic = { id: string; name: string; activeDevices: number; lastSubscriptionAt: string | null; lastError: string | null };

export function PushDiagnostics() {
  const [items, setItems] = useState<Diagnostic[] | null>(null);
  useEffect(() => { void fetch("/api/admin/push/diagnostics", { cache: "no-store" }).then((response) => response.ok ? response.json() : []).then(setItems); }, []);
  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"><h2 className="font-semibold">Notificaciones de logros</h2><p className="mt-1 text-sm text-zinc-500">Diagnóstico de dispositivos. No habilita envíos manuales.</p>{items === null ? <p className="mt-4 text-sm text-zinc-500">Cargando…</p> : items.length === 0 ? <p className="mt-4 text-sm text-zinc-500">Todavía no hay dispositivos suscriptos.</p> : <div className="mt-4 space-y-2">{items.map((item) => <article key={item.id} className="rounded-xl bg-zinc-950 p-3"><div className="flex justify-between gap-3"><strong className="text-sm">{item.name}</strong><span className={item.activeDevices ? "text-xs text-emerald-300" : "text-xs text-zinc-500"}>{item.activeDevices} dispositivo{item.activeDevices === 1 ? "" : "s"}</span></div>{item.lastSubscriptionAt && <p className="mt-1 text-xs text-zinc-500">Última suscripción: {new Date(item.lastSubscriptionAt).toLocaleString("es-AR")}</p>}{item.lastError && <p className="mt-1 text-xs text-red-300">Último error: {item.lastError}</p>}</article>)}</div>}</section>;
}
