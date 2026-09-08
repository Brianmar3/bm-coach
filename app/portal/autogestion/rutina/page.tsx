import Link from "next/link";
import { requireSelfServiceAccount } from "@/lib/self-service-account";
import { SelfServiceShell } from "@/componentes/self-service-shell";
import { BmRoutineIcon } from "@/componentes/icons";
export default async function SelfServiceRoutinePage() {
  await requireSelfServiceAccount();
  return <SelfServiceShell><h1 className="text-3xl font-bold">Tu rutina</h1><section className="mt-5 rounded-3xl border border-yellow-400/25 bg-zinc-900 p-6 text-center"><BmRoutineIcon size={40} className="mx-auto text-yellow-400" /><h2 className="mt-4 text-xl font-semibold">Estamos preparando tu creador de rutinas.</h2><p className="mt-3 text-sm leading-relaxed text-zinc-300">Cuando esté listo, vas a poder crear una rutina a partir de tu objetivo y tus preferencias.</p><Link href="/portal/autogestion" className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl border border-yellow-400/40 px-5 font-semibold text-yellow-400">Volver al inicio</Link></section></SelfServiceShell>;
}
