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
    return active ? "bg-yellow-400 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-white";
  };
  return <div className="min-h-screen bg-zinc-950 text-white">
    <header className="sticky top-0 z-30 border-b border-zinc-800 bg-black/95">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4">
        <Link href="/portal" className="flex min-w-0 items-center gap-2 sm:gap-3" aria-label="Ir al inicio de BM Training"><BrandMark /><div className="hidden min-w-0 sm:block"><p className="truncate font-bold leading-tight">BM Training</p><p className="hidden text-[10px] text-zinc-500 sm:block">Gestión, entrenamiento y seguimiento</p></div></Link>
        <div className="flex min-w-0 items-center gap-2">
          <Link href="/portal/perfil" className="flex min-w-0 items-center gap-2 rounded-lg px-1 py-1 hover:bg-zinc-900">{profileImageUrl ? <Image src={profileImageUrl} alt="" width={32} height={32} unoptimized className="h-8 w-8 shrink-0 rounded-full object-cover" /> : <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-yellow-400/15 text-[10px] font-black text-yellow-300">{studentName.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</span>}<span className="max-w-24 truncate text-xs font-medium text-zinc-300 sm:max-w-48">{studentName}</span></Link>
          <button onClick={logout} disabled={loggingOut} className="rounded-lg px-2 py-2 text-xs text-zinc-500 hover:bg-zinc-900 hover:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-400" aria-label="Cerrar sesión">{loggingOut ? "Cerrando…" : "Salir"}</button>
        </div>
      </div>
      <nav aria-label="Navegación del portal" className="mx-auto hidden max-w-6xl gap-1 px-4 pb-2 md:flex">{links.map(([title, href]) => <Link key={href} href={href} className={`rounded-lg px-3 py-2 text-sm font-semibold ${linkStyle(href)}`}>{title}</Link>)}</nav>
    </header>
    <main className="mx-auto max-w-6xl p-4 pb-24 sm:p-6 md:pb-12">{children}</main>
    <nav aria-label="Navegación móvil del portal" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-zinc-800 bg-black/95 px-1 pb-[env(safe-area-inset-bottom)] md:hidden">{links.map(([title, href, icon]) => <Link key={href} href={href} className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg text-[10px] font-bold focus:outline-none focus:ring-2 focus:ring-inset focus:ring-yellow-400 ${linkStyle(href)}`}><span aria-hidden="true" className="text-lg leading-none">{icon}</span>{title}</Link>)}</nav>
  </div>;
}
