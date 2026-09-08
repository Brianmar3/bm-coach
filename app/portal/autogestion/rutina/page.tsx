import { requireSelfServiceAccount } from "@/lib/self-service-account";
import { SelfServiceShell } from "@/componentes/self-service-shell";
import { PortalRoutineFrame } from "@/componentes/portal-visuals";
import { BmRoutineIcon } from "@/componentes/icons";
export default async function SelfServiceRoutinePage() {
  const { student } = await requireSelfServiceAccount();
  return <SelfServiceShell student={student}><div className="mx-auto max-w-5xl space-y-4"><header className="mb-6"><h1 className="text-2xl font-bold">Tu rutina</h1></header><PortalRoutineFrame>
    <div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full border border-yellow-400/25 bg-yellow-400/[.05] text-yellow-300"><BmRoutineIcon size={22} /></span><h2 className="text-base font-black leading-tight text-zinc-50 min-[390px]:text-lg">Todavía no creaste una rutina.</h2></div>
    <button type="button" disabled aria-describedby="routine-creation-access" className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-yellow-400/45 px-4 text-sm font-bold text-yellow-300 disabled:cursor-not-allowed disabled:opacity-60">Crear mi rutina</button>
    <p id="routine-creation-access" className="mt-2 text-xs leading-relaxed text-zinc-500">La creación de rutinas aún no está habilitada.</p>
  </PortalRoutineFrame></div></SelfServiceShell>;
}
