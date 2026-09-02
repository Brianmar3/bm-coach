"use client";

import { useEffect, useState } from "react";

type Diagnostic = { id: string; name: string; activeDevices: number; lastSubscriptionAt: string | null; lastError: string | null };

export function PushDiagnostics() {
  const [items, setItems] = useState<Diagnostic[] | null>(null);
  useEffect(() => { void fetch("/api/admin/push/diagnostics", { cache: "no-store" }).then((response) => response.ok ? response.json() : []).then(setItems); }, []);
  return <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6"><h2 className="font-semibold">Diagnóstico de notificaciones</h2><p className="mt-1 text-sm text-zinc-500">Alumnos, dispositivos y último registro técnico. No habilita envíos manuales.</p>{items === null ? <p className="mt-4 text-sm text-zinc-500">Cargando…</p> : items.length === 0 ? <p className="mt-4 text-sm text-zinc-500">Todavía no hay alumnos con dispositivos suscriptos.</p> : <div className="mt-4 space-y-2">{items.map((item) => <article key={item.id} className="rounded-xl bg-zinc-950 p-3"><div className="flex flex-col gap-1 sm:flex-row sm:justify-between sm:gap-3"><strong className="break-words text-sm">{item.name}</strong><span className={item.activeDevices ? "text-xs text-emerald-300" : "text-xs text-zinc-500"}>{item.activeDevices} dispositivo{item.activeDevices === 1 ? "" : "s"} activo{item.activeDevices === 1 ? "" : "s"}</span></div><p className="mt-1 text-xs text-zinc-500">Última suscripción: {item.lastSubscriptionAt ? new Date(item.lastSubscriptionAt).toLocaleString("es-AR") : "Sin registro"}</p>{item.lastError && <p className="mt-1 break-words text-xs text-red-300">Último error registrado: {item.lastError}</p>}</article>)}</div>}</section>;
}
