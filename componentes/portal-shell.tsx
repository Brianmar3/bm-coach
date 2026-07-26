"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

const links = [
  ["Inicio", "/portal", "⌂"],
  ["Rutina", "/portal/rutina", "◫"],
  ["Historial", "/portal/historial", "↺"],
  ["Clases", "/portal/clases", "◷"],
  ["Perfil", "/portal/perfil", "○"],
] as const;

function BrandMark({ small = false }: { small?: boolean }) {
  return <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-[35%_35%_42%_42%] border-2 border-yellow-400 bg-black font-black tracking-tighter text-yellow-400 shadow-[inset_0_0_0_2px_rgba(250,204,21,.12)] ${small ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm"}`}>BM</span>;
}

export function PortalShell({ studentName, children }: { studentName: string; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  async function logout() {
    setLoggingOut(true);
    try { await fetch("/api/portal/logout", { method: "POST" }); }
    finally { router.replace("/portal/login"); router.refresh(); }
  }
  const linkStyle = (href: string) => {
    const active = href === "/portal" ? pathname === href : pathname.startsWith(href);
    return active ? "bg-yellow-400 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-white";
  };
  return <div className="min-h-screen bg-zinc-950 text-white">
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-black/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5">
        <Link href="/portal" className="flex items-center gap-3" aria-label="Ir al inicio de BM Training"><BrandMark /><div><p className="font-bold leading-tight">BM Training</p><p className="text-[10px] text-zinc-500">Gestión, entrenamiento y seguimiento</p></div></Link>
        <div className="flex items-center gap-3">
          <Link href="/portal/perfil" className="max-w-32 truncate text-xs font-medium text-zinc-300 sm:max-w-none">{studentName}</Link>
          <button onClick={logout} disabled={loggingOut} className="rounded-lg px-2 py-2 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400" aria-label="Cerrar sesión">{loggingOut ? "Cerrando…" : "Salir"}</button>
        </div>
      </div>
      <nav aria-label="Navegación del portal" className="mx-auto hidden max-w-6xl gap-1 px-4 pb-2 md:flex">{links.map(([title, href]) => <Link key={href} href={href} className={`rounded-lg px-3 py-2 text-sm font-semibold ${linkStyle(href)}`}>{title}</Link>)}</nav>
    </header>
    <main className="mx-auto max-w-6xl p-4 pb-24 sm:p-6 md:pb-12">{children}</main>
    <nav aria-label="Navegación móvil del portal" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-800 bg-black/95 px-1 pb-[env(safe-area-inset-bottom)] md:hidden">{links.map(([title, href, icon]) => <Link key={href} href={href} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-yellow-400 ${linkStyle(href)}`}><span aria-hidden="true" className="text-lg leading-none">{icon}</span>{title}</Link>)}</nav>
  </div>;
}
