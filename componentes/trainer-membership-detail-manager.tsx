"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Subscription, TrainerMembershipManager } from "@/componentes/trainer-membership-manager";

export function TrainerMembershipDetailManager({ trainer, subscription }: { trainer: { id: string; name: string }; subscription: Subscription | null }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const router = useRouter();
  return <>
    <button type="button" onClick={() => setOpen(true)} className="mt-5 inline-flex rounded-xl bg-yellow-400 px-4 py-2 text-sm font-black text-zinc-950">{subscription ? "Gestionar membresía" : "Configurar membresía"}</button>
    {notice && <p role="status" className="fixed bottom-5 left-4 right-4 z-[90] rounded-xl border border-emerald-400/30 bg-zinc-900 p-3 text-center text-sm text-emerald-200 shadow-xl sm:left-auto sm:right-5">{notice}</p>}
    {open && <TrainerMembershipManager trainer={trainer} subscription={subscription} onClose={() => setOpen(false)} onSaved={async (message) => { router.refresh(); setOpen(false); setNotice(message); }} />}
  </>;
}
