"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

const links = [["Resumen", "/platform"], ["Entrenadores", "/platform/trainers"], ["Configuración", "/platform/settings"]] as const;

export function PlatformShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/master");
    router.refresh();
  }
  return <div className="min-h-screen bg-black text-white">
    <header className="sticky top-0 z-50 border-b border-yellow-400/15 bg-zinc-950/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
        <Link href="/platform" className="shrink-0 leading-none"><span className="block text-[10px] font-black tracking-[.16em] text-yellow-400">BM TRAINING</span><span className="mt-1 block text-sm font-black">Plataforma</span></Link>
        <nav aria-label="Navegación de plataforma" className="min-w-0 flex-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><div className="flex w-max items-center gap-1 px-1">
          {links.map(([label, href]) => { const active = href === "/platform" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`shrink-0 rounded-lg px-2.5 py-2 text-xs font-bold transition sm:px-3 sm:text-sm ${active ? "bg-yellow-400 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>{label}</Link>; })}
        </div></nav>
        <details className="group relative shrink-0"><summary aria-label="Opciones de cuenta" className="grid size-9 cursor-pointer list-none place-items-center rounded-lg border border-zinc-700 text-lg text-zinc-300 marker:content-none hover:border-yellow-400 hover:text-white">•••</summary><div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900 p-1.5 shadow-2xl"><Link href="/dashboard" className="block rounded-lg px-3 py-2.5 text-sm font-bold hover:bg-zinc-800">Ir a BM Training</Link><button type="button" onClick={logout} className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-zinc-400 hover:bg-zinc-800 hover:text-red-300">Cerrar sesión</button></div></details>
      </div>
    </header>
    {children}
  </div>;
}
