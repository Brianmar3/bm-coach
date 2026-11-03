"use client";
import { useRef, useState } from "react";
import { CLASS_REACTIONS, type ClassReaction } from "@/lib/class-communication";

export function ClassConfirmationReactions({ notificationId, reaction, onChange }: { notificationId: string; reaction?: string | null; onChange: (reaction: ClassReaction) => void }) {
  const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const inFlight = useRef(false);
  async function select(value: ClassReaction) {
    if (inFlight.current) return; inFlight.current = true; setSaving(true); setError("");
    try {
      const response = await fetch(`/api/admin/notifications/${encodeURIComponent(notificationId)}/reaction`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reaction: value }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "No se pudo guardar la reacción.");
      onChange(body.reaction);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "No se pudo guardar la reacción."); }
    finally { inFlight.current = false; setSaving(false); }
  }
  return <div className="px-4 pb-3"><div role="group" aria-label="Reaccionar a la confirmación" className="flex flex-wrap gap-1">{CLASS_REACTIONS.map(item => <button key={item.value} type="button" disabled={saving} aria-pressed={reaction === item.value} onClick={() => void select(item.value)} className={`min-h-11 rounded-lg border px-2 py-1 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-yellow-300 disabled:opacity-50 ${reaction === item.value ? "border-yellow-400 bg-yellow-400/10 text-yellow-300" : "border-zinc-700 text-zinc-300"}`}>{item.label}</button>)}</div>{error && <p role="alert" className="mt-2 text-xs text-red-300">{error}</p>}</div>;
}
