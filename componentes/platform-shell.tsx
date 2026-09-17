"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";

const links = [["Resumen", "/platform"], ["Entrenadores", "/platform/trainers"]] as const;
const future = ["Membresías", "Invitaciones", "Configuración"];

export function PlatformShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/master");
    router.refresh();
  }
  return <div className="min-h-screen bg-black text-white">
    <header className="border-b border-yellow-400/15 bg-zinc-950/95 px-4 py-4 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-xs font-black tracking-[.18em] text-yellow-400">BM TRAINING</p><p className="mt-1 text-lg font-black">Plataforma</p></div>
        <nav aria-label="Navegación de plataforma" className="flex flex-wrap items-center gap-2">
          {links.map(([label, href]) => { const active = href === "/platform" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`rounded-xl px-3 py-2 text-sm font-bold ${active ? "bg-yellow-400 text-zinc-950" : "text-zinc-300 hover:bg-zinc-800"}`}>{label}</Link>; })}
          {future.map((label) => <span key={label} aria-disabled="true" className="cursor-not-allowed rounded-xl px-3 py-2 text-sm text-zinc-600" title="Disponible en una próxima fase">{label}</span>)}
        </nav>
        <div className="flex items-center gap-2"><Link href="/dashboard" className="rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-200 hover:border-yellow-400">Ir a BM Training</Link><button type="button" onClick={logout} className="rounded-xl px-3 py-2 text-sm text-zinc-500 hover:text-red-300">Cerrar sesión</button></div>
      </div>
    </header>
    {children}
  </div>;
}
