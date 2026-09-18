"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Subscription, TrainerMembershipManager } from "@/componentes/trainer-membership-manager";

export function TrainerMembershipDetailManager({ trainer, subscription }: { trainer: { id: string; name: string }; subscription: Subscription | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return <>
    <button type="button" onClick={() => setOpen(true)} className="mt-5 inline-flex rounded-xl bg-yellow-400 px-4 py-2 text-sm font-black text-zinc-950">{subscription ? "Gestionar membresía" : "Configurar membresía"}</button>
    {open && <TrainerMembershipManager trainer={trainer} subscription={subscription} onClose={() => setOpen(false)} onSaved={async () => { router.refresh(); setOpen(false); }} />}
  </>;
}
