"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SelfServiceAccountActions() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div className="mt-6"><button disabled={busy} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-sm text-zinc-200" onClick={async () => {
    setBusy(true); setError("");
    try { const response = await fetch("/api/portal/logout", { method: "POST" }); if (!response.ok) throw new Error(); router.replace("/portal/login"); router.refresh(); }
    catch { setError("No pudimos cerrar la sesión. Intentá nuevamente."); }
    finally { setBusy(false); }
  }}>{busy ? "Cerrando…" : "Cerrar sesión"}</button>{error && <p role="alert" className="mt-2 text-red-300">{error}</p>}</div>;
}
