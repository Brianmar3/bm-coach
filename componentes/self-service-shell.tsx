"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BmHomeIcon, BmRoutineIcon, BmProfileIcon } from "@/componentes/icons";

// Only enabled destinations; no coached-portal providers or mutations.
const links = [
  { title: "Inicio", href: "/portal/autogestion", Icon: BmHomeIcon },
  { title: "Rutina", href: "/portal/autogestion/rutina", Icon: BmRoutineIcon },
  { title: "Perfil", href: "/portal/autogestion/perfil", Icon: BmProfileIcon },
];
export function SelfServiceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen bg-[#070707] text-white">
    <header className="sticky top-0 z-30 rounded-b-[24px] border-b border-yellow-400/20 bg-black/95 pt-[env(safe-area-inset-top)] shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur-xl">
      <div className="mx-auto flex h-[4.5rem] max-w-6xl min-w-0 items-center justify-between gap-2 px-3 sm:px-5">
        <Link href="/portal/autogestion" className="flex min-w-0 items-center gap-2" aria-label="Ir al inicio de BM Training"><Image src="/bm-training-mark.png" width={44} height={44} alt="" priority className="h-9 w-9 shrink-0 object-contain sm:h-11 sm:w-11" /><span className="min-w-0"><span className="block text-sm font-black tracking-wide">BM <strong className="text-yellow-400">TRAINING</strong></span><span className="block max-w-44 text-[10px] leading-tight text-zinc-400">Gestión, entrenamiento y seguimiento</span></span></Link>
        <Link href="/portal/autogestion/perfil" aria-label="Mi cuenta" className="flex size-11 shrink-0 items-center justify-center rounded-full border border-yellow-400/30 text-yellow-400"><BmProfileIcon size={24} /></Link>
      </div>
    </header>
    <main className="mx-auto w-full max-w-3xl px-4 pt-5 pb-[calc(var(--portal-bottom-nav-height)+var(--portal-bottom-nav-offset)+var(--portal-bottom-nav-clearance)+env(safe-area-inset-bottom))] sm:px-6 sm:pt-7">{children}</main>
    <nav aria-label="Navegación principal" className="fixed inset-x-4 bottom-[calc(var(--portal-bottom-nav-offset)+env(safe-area-inset-bottom))] z-40 mx-auto grid min-h-[var(--portal-bottom-nav-height)] max-w-lg grid-cols-3 rounded-full border border-yellow-400/20 bg-black/95 px-3 py-2 shadow-2xl backdrop-blur-xl">
      {links.map(({ title, href, Icon }) => { const active = href === "/portal/autogestion" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`flex min-h-11 flex-col items-center justify-center gap-1 rounded-full text-xs font-semibold focus-visible:outline-2 focus-visible:outline-yellow-400 ${active ? "border border-yellow-400/40 text-yellow-400" : "text-zinc-400 hover:text-white"}`}><Icon size={24} /><span>{title}</span></Link>; })}
    </nav>
  </div>;
}
