"use client";

import { useState } from "react";

export function TrainerAccountActions({ trainerId }: { trainerId: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetUrl, setResetUrl] = useState("");
  async function generate() {
    setLoading(true); setError(""); setResetUrl("");
    try {
      const response = await fetch(`/api/platform/trainers/${encodeURIComponent(trainerId)}/password-reset`, { method: "POST" });
      const result = await response.json() as { error?: string; resetUrl?: string };
      if (!response.ok || !result.resetUrl) throw new Error(result.error || "No se pudo generar el enlace.");
      setResetUrl(result.resetUrl);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No se pudo generar el enlace."); }
    finally { setLoading(false); }
  }
  return <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900/75 p-5"><h2 className="font-bold">Acceso del entrenador</h2><p className="mt-1 text-sm text-zinc-500">Generá un enlace de un solo uso. La contraseña nunca se muestra ni se envía desde el panel.</p><button type="button" disabled={loading} onClick={generate} className="mt-4 rounded-xl border border-yellow-400/30 px-4 py-2 text-sm font-bold text-yellow-300 disabled:opacity-60">{loading ? "Generando…" : "Restablecer contraseña"}</button>{error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}{resetUrl && <div className="mt-4 rounded-xl bg-black/40 p-3"><p className="break-all text-xs text-zinc-300">{resetUrl}</p><button type="button" onClick={() => navigator.clipboard.writeText(resetUrl)} className="mt-3 rounded-lg bg-yellow-400 px-3 py-2 text-xs font-black text-zinc-950">Copiar enlace</button><p className="mt-2 text-[11px] text-zinc-500">Vence en 30 minutos y queda invalidado al usarlo.</p></div>}</section>;
}
