import Link from "next/link";
import { requireSelfServiceAccount } from "@/lib/self-service-account";
import { SelfServiceShell } from "@/componentes/self-service-shell";
import { SelfServiceAccountActions } from "@/componentes/self-service-account-actions";
import { BmProfileIcon } from "@/componentes/icons";
export default async function SelfServiceProfilePage() {
  const { student } = await requireSelfServiceAccount();
  return <SelfServiceShell><h1 className="text-3xl font-bold">Mi cuenta</h1><p className="mt-2 break-words text-zinc-300">{student.firstName} {student.lastName}</p><section className="mt-5 rounded-3xl border border-yellow-400/20 bg-zinc-900 p-5"><Link href="/portal/autogestion/perfil/informacion" className="flex min-h-14 items-center gap-3 font-semibold"><BmProfileIcon className="text-yellow-400" size={26} />Mi información <span className="ml-auto text-yellow-400" aria-hidden="true">→</span></Link><SelfServiceAccountActions /></section></SelfServiceShell>;
}
