import Link from "next/link";
import { requireSelfServiceAccount } from "@/lib/self-service-account";
import { SelfServiceShell } from "@/componentes/self-service-shell";
import { SelfServiceAccountActions } from "@/componentes/self-service-account-actions";
import { PortalProfileFrame, PortalProfileAvatar } from "@/componentes/portal-visuals";
import { BmProfileIcon, BmEditIcon, BmChevronRightIcon } from "@/componentes/icons";
export default async function SelfServiceProfilePage() {
  const { student } = await requireSelfServiceAccount();
  return <SelfServiceShell student={student}><div className="mx-auto max-w-4xl space-y-4 pb-3">
    <PortalProfileFrame><div className="flex items-center gap-4 sm:gap-7"><PortalProfileAvatar src={student.profileImageUrl} name={`${student.firstName} ${student.lastName}`} /><div className="min-w-0 flex-1"><p className="text-xs font-bold text-yellow-300">Mi cuenta</p><h1 className="mt-2 break-words text-2xl font-black leading-tight sm:text-4xl">{student.firstName} {student.lastName}</h1></div></div></PortalProfileFrame>
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
      {[{ title: "Mi información", href: "/portal/autogestion/perfil/informacion", Icon: BmProfileIcon }, { title: "Editar perfil", href: "/portal/autogestion/perfil/editar", Icon: BmEditIcon }].map(({ title, href, Icon }) => <Link key={href} href={href} className="flex min-h-14 items-center gap-3 border-b border-white/10 px-4 py-3 text-sm"><Icon size={22} className="shrink-0 text-yellow-400" /><span className="flex-1">{title}</span><BmChevronRightIcon size={18} className="text-zinc-500" /></Link>)}
    </section><SelfServiceAccountActions />
  </div></SelfServiceShell>;
}
