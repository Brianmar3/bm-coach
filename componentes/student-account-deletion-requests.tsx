"use client";

import { useEffect, useState } from "react";

type DeletionRequest = { id: string; studentId: string; studentName: string; requestedAt: string; status: "PENDING"; body: string };

export function StudentAccountDeletionRequests({ onViewStudent }: { onViewStudent: (studentId: string) => void }) {
  const [requests, setRequests] = useState<DeletionRequest[]>([]);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<DeletionRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/account-deletion", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar las solicitudes.");
        return response.json() as Promise<{ requests: DeletionRequest[] }>;
      })
      .then((payload) => setRequests(payload.requests))
      .catch((cause: Error) => { if (cause.name !== "AbortError") setError(cause.message); });
    return () => controller.abort();
  }, []);

  async function resolveRequest() {
    if (!selected || busy || confirmation !== "ELIMINAR") return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/account-deletion", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: selected.id, confirmation }) });
      if (!response.ok) { const result = await response.json().catch(() => ({})) as { error?: string }; throw new Error(result.error ?? "No se pudo eliminar la cuenta."); }
      setRequests((current) => current.filter((item) => item.id !== selected.id));
      setSelected(null);
      setConfirmation("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo gestionar la solicitud.");
    } finally {
      setBusy(false);
    }
  }

  const date = (value: string) => new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

  return <section className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900/70 text-white">
    <button type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)} className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold text-zinc-200">
      <span>Solicitudes de eliminación{requests.length > 0 ? <span className="ml-2 rounded-full border border-yellow-400/30 bg-yellow-400/10 px-2 py-0.5 text-xs text-yellow-300">{requests.length}</span> : null}</span>
      <span aria-hidden="true" className="text-yellow-400">{open ? "⌃" : "⌄"}</span>
    </button>
    {open && <div className="border-t border-zinc-800 p-4">
      {error && <p role="alert" className="mb-3 text-sm text-red-300">{error}</p>}
      {requests.length === 0 ? <p className="text-sm text-zinc-500">No hay solicitudes pendientes.</p> : <div className="space-y-2">{requests.map((item) => <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-black/25 p-3">
        <div><p className="font-semibold">{item.studentName}</p><p className="text-xs text-zinc-400">{date(item.requestedAt)} · Pendiente</p></div>
        <div className="flex flex-wrap gap-2"><button type="button" onClick={() => onViewStudent(item.studentId)} className="min-h-10 rounded-xl border border-zinc-700 px-3 text-sm text-zinc-200">Ver alumno</button><button type="button" onClick={() => { setSelected(item); setConfirmation(""); setError(""); }} className="min-h-10 rounded-xl border border-yellow-400/30 px-3 text-sm font-semibold text-yellow-300">Eliminar cuenta y datos</button></div>
      </div>)}</div>}
    </div>}
    {selected && <div className="fixed inset-0 z-[90] grid place-items-center bg-black/85 p-4" role="presentation"><section role="alertdialog" aria-modal="true" aria-labelledby="account-deletion-manage-title" className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl">
      <h2 id="account-deletion-manage-title" className="text-xl font-bold">Eliminar cuenta y datos</h2>
      <p className="mt-3 text-sm text-zinc-300"><strong>{selected.studentName}</strong> · {date(selected.requestedAt)}</p>
      <p className="mt-1 text-sm text-yellow-300">Estado: pendiente</p>
      <p className="mt-4 text-sm text-zinc-300">{selected.body}</p>
      <p className="mt-4 text-sm leading-6 text-zinc-300">Esta acción es irreversible. Se eliminará el acceso del alumno, su perfil, datos asociados y archivos privados verificados. Si un archivo no puede eliminarse, la solicitud seguirá pendiente.</p>
      <label htmlFor="account-deletion-confirmation" className="mt-4 block text-sm font-semibold text-amber-200">Escribí ELIMINAR para confirmar</label>
      <input id="account-deletion-confirmation" autoComplete="off" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-zinc-700 bg-black px-3 text-white focus:border-yellow-400 focus:outline-none" />
      {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><button type="button" disabled={busy} onClick={() => { setSelected(null); setConfirmation(""); setError(""); }} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm">Volver</button><button type="button" disabled={busy || confirmation !== "ELIMINAR"} onClick={() => void resolveRequest()} className="min-h-11 rounded-xl border border-red-400/50 bg-red-400/10 px-4 text-sm font-semibold text-red-200 disabled:opacity-50">{busy ? "Eliminando…" : "Eliminar cuenta y datos"}</button></div>
    </section></div>}
  </section>;
}
