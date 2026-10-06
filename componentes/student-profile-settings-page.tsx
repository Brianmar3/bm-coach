"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { ChangePasswordCard } from "@/componentes/portal-section";
import { BmBackIcon } from "@/componentes/icons";
import { AppearanceSelector } from "@/componentes/appearance-selector";

export function StudentProfileSettingsPage({ page }: { page: "security" | "privacy" | "preferences" | "help" }) {
  const reduced = useReducedMotion();
  const content = {
    security: { eyebrow: "Seguridad", title: "Cambiar contraseña", body: <ChangePasswordCard /> },
    privacy: { eyebrow: "Privacidad", title: "Tus datos en BM Training", body: <PrivacySettings /> },
    preferences: { eyebrow: "Preferencias", title: "Apariencia y accesibilidad", body: <div className="space-y-4"><Info><h2 className="font-semibold text-[var(--foreground)]">Apariencia</h2><AppearanceSelector /></Info><Info><p>BM Training respeta las preferencias de movimiento configuradas en tu dispositivo.</p><p>Movimiento reducido: <strong className="text-zinc-100">{reduced ? "activado" : "desactivado"}</strong>.</p><p>Podés cambiar esta preferencia desde los ajustes de accesibilidad de tu dispositivo.</p></Info></div> },
    help: { eyebrow: "Ayuda", title: "¿Cómo podemos ayudarte?", body: <Info><p>Usá Inicio para ver tu próxima actividad, Rutina para registrar el entrenamiento y la campana para consultar novedades.</p><p>Para modificar datos administrativos o resolver una consulta sobre tu plan, contactá a tu entrenador.</p><Link href="/portal/comentarios" className="inline-flex min-h-11 items-center rounded-xl border border-yellow-400/45 px-4 font-bold text-yellow-300">Enviar un comentario</Link></Info> },
  }[page];
  return <div className="mx-auto max-w-3xl pb-4"><Link href="/portal/perfil" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-zinc-800 px-4 text-sm text-zinc-300"><BmBackIcon size={18} /> Volver al perfil</Link><header className="mt-5"><p className="text-xs font-black uppercase tracking-[.2em] text-yellow-400">{content.eyebrow}</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{content.title}</h1></header><div className="mt-5">{content.body}</div></div>;
}

function Info({ children }: { children: ReactNode }) { return <section className="space-y-4 rounded-[24px] border border-yellow-400/20 bg-[linear-gradient(145deg,#151515,#0a0a0a)] p-5 text-sm leading-relaxed text-zinc-400 sm:p-6">{children}</section>; }

function PrivacySettings() {
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [requested, setRequested] = useState(false);
  const [requestedAt, setRequestedAt] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/portal/account-deletion", { cache: "no-store", signal: controller.signal })
      .then((response) => response.ok ? response.json() as Promise<{ requested: boolean; requestedAt: string | null }> : null)
      .then((state) => { if (state) { setRequested(state.requested); setRequestedAt(state.requestedAt); } })
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  async function requestDeletion() {
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/portal/account-deletion", { method: "POST" });
      const body = await response.json() as { requested?: boolean; requestedAt?: string; error?: string };
      if (response.status === 401) {
        window.location.assign("/portal/login");
        return;
      }
      if (!response.ok || !body.requested) throw new Error(body.error || "No se pudo registrar la solicitud.");
      setRequested(true);
      setRequestedAt(body.requestedAt ?? null);
      setConfirming(false);
      setMessage("Solicitud registrada. Tu cuenta no se eliminará hasta que la solicitud sea revisada.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo registrar la solicitud.");
    } finally {
      setSaving(false);
    }
  }

  return <>
    <Info><p>Tus datos se muestran únicamente dentro de tu cuenta.</p><p>Los datos administrativos de plan, servicio y estado los gestiona tu entrenador.</p><p>Los cambios de información personal que realices también se reflejan en tu ficha del entrenador.</p></Info>
    <section className="mt-5 rounded-[24px] border border-zinc-800 bg-zinc-950/70 p-5 sm:p-6">
      <h2 className="font-bold text-zinc-200">Eliminar cuenta</h2>
      <p className="mt-2 text-sm leading-relaxed text-zinc-500">Podés solicitar la eliminación de tu cuenta y de los datos asociados.</p>
      <button type="button" disabled={saving || requested} onClick={() => setConfirming(true)} className="mt-4 min-h-11 rounded-xl border border-red-400/30 px-4 text-sm font-semibold text-red-300 transition hover:border-red-300/60 hover:bg-red-400/[.06] disabled:cursor-not-allowed disabled:opacity-50">
        {requested ? "Solicitud registrada" : "Solicitar eliminación de cuenta"}
      </button>
      {requested && requestedAt && <p className="mt-2 text-xs text-zinc-400">Solicitada el {new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(requestedAt))}.</p>}
      {message && <p role="status" className={`mt-3 text-sm ${requested ? "text-emerald-300" : "text-red-300"}`}>{message}</p>}
    </section>
    {confirming && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setConfirming(false); }}>
      <section role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" aria-describedby="delete-account-description" className="w-full max-w-md rounded-3xl border border-red-400/35 bg-[#111] p-6 shadow-2xl">
        <h2 id="delete-account-title" className="text-xl font-black text-white">Confirmar solicitud</h2>
        <p id="delete-account-description" className="mt-3 text-sm leading-relaxed text-zinc-400">Esta solicitud inicia el proceso de eliminación de tu cuenta y sus datos asociados. Una vez completada, la acción puede ser irreversible. Tu cuenta no se eliminará al instante.</p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <button type="button" disabled={saving} onClick={() => setConfirming(false)} className="min-h-11 rounded-xl border border-zinc-700 px-4 font-semibold text-zinc-300 disabled:opacity-50">Cancelar</button>
          <button type="button" disabled={saving} onClick={requestDeletion} className="min-h-11 rounded-xl border border-red-400/50 bg-red-400/10 px-4 font-bold text-red-200 disabled:opacity-50">{saving ? "Enviando…" : "Confirmar solicitud"}</button>
        </div>
      </section>
    </div>}
  </>;
}

function useReducedMotion() { const [reduced, setReduced] = useState(false); useEffect(() => { const media = window.matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setReduced(media.matches); update(); media.addEventListener("change", update); return () => media.removeEventListener("change", update); }, []); return reduced; }
