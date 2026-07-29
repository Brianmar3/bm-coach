"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

const links = [
  ["Inicio", "/portal", "⌂"],
  ["Rutina", "/portal/rutina", "◫"],
  ["Clases", "/portal/clases", "◷"],
  ["Evaluaciones", "/portal/evaluaciones", "◇"],
  ["Perfil", "/portal/perfil", "○"],
] as const;

function BrandMark() {
  return <Image src="/bm-training-mark.png" alt="" width={44} height={44} priority className="h-11 w-11 shrink-0 rounded-xl object-contain" />;
}

export function PortalShell({ studentName, profileImageUrl, children }: { studentName: string; profileImageUrl: string; children: ReactNode }) {
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
    return active ? "text-yellow-400" : "text-zinc-500 hover:text-zinc-200";
  };
  return <div className="min-h-screen bg-[#070707] text-white">
    <header className="sticky top-0 z-30 border-b border-yellow-400/10 bg-black/95 shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-5">
        <Link href="/portal" className="flex min-w-0 items-center gap-2.5" aria-label="Ir al inicio de BM Training"><BrandMark /><div className="min-w-0"><p className="truncate text-sm font-black tracking-[.08em] sm:text-base"><span className="text-white">BM </span><span className="text-yellow-400">TRAINING</span></p><p className="hidden text-[9px] tracking-wide text-zinc-500 sm:block">Gestión, entrenamiento y seguimiento</p></div></Link>
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <Link href="/portal/perfil" className="group flex min-w-0 items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-zinc-900">{profileImageUrl ? <Image src={profileImageUrl} alt="" width={36} height={36} unoptimized className="h-9 w-9 shrink-0 rounded-full border border-yellow-400/30 object-cover" /> : <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-yellow-400/40 bg-black text-[10px] font-black text-yellow-300">{studentName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>}<span className="hidden min-w-0 sm:block"><span className="block max-w-40 truncate text-xs font-semibold text-zinc-200">{studentName}</span><span className="mt-0.5 block text-[10px] text-zinc-500 group-hover:text-yellow-300">Ver perfil <span className="text-yellow-400">›</span></span></span></Link>
          <button onClick={logout} disabled={loggingOut} className="flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400" aria-label="Cerrar sesión"><span aria-hidden="true" className="text-base">↪</span><span className="hidden sm:inline">{loggingOut ? "Cerrando…" : "Salir"}</span></button>
        </div>
      </div>
      <nav aria-label="Navegación del portal" className="mx-auto hidden max-w-6xl gap-5 px-5 pb-2 md:flex">{links.map(([title, href]) => <Link key={href} href={href} className={`border-b-2 px-1 py-2 text-sm font-semibold transition ${linkStyle(href)} ${linkStyle(href) === "text-yellow-400" ? "border-yellow-400" : "border-transparent"}`}>{title}</Link>)}</nav>
    </header>
    <main className="mx-auto max-w-6xl p-3 pb-28 sm:p-6 md:pb-12">{children}</main>
    <nav aria-label="Navegación móvil del portal" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-yellow-400/10 bg-black/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,.45)] backdrop-blur md:hidden">{links.map(([title, href, icon]) => { const active = href === "/portal" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-yellow-400 ${linkStyle(href)}`}><span aria-hidden="true" className="text-lg leading-none">{icon}</span>{title}{active && <span className="absolute bottom-1 h-0.5 w-5 rounded-full bg-yellow-400" />}</Link>; })}</nav>
  </div>;
}
