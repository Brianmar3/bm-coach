"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";

const links = [["Inicio", "/portal"], ["Mi rutina", "/portal/rutina"], ["Clases", "/portal/clases"], ["Evaluaciones", "/portal/evaluaciones"], ["Pagos", "/portal/pagos"], ["Mi perfil", "/portal/perfil"]];

export function PortalShell({ studentName, children }: { studentName: string; children: ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const [loggingOut, setLoggingOut] = useState(false);
  async function logout() { setLoggingOut(true); try { await fetch("/api/portal/logout", { method: "POST" }); } finally { router.replace("/portal/login"); router.refresh(); } }
  return <div className="min-h-screen bg-zinc-950 text-white"><header className="sticky top-0 z-30 border-b border-zinc-800 bg-black/95 backdrop-blur"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3"><Link href="/portal" className="flex items-center gap-3"><Image src="/logo.png" alt="BM Coach" width={42} height={42} priority className="h-11 w-11 rounded-xl object-contain" /><div><p className="font-bold">BM Coach</p><p className="text-xs text-yellow-400">Portal del alumno</p></div></Link><div className="text-right"><p className="max-w-36 truncate text-sm font-medium sm:max-w-none">{studentName}</p><button onClick={logout} disabled={loggingOut} className="text-xs text-zinc-400 hover:text-yellow-300">{loggingOut ? "Cerrando…" : "Cerrar sesión"}</button></div></div><nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 pb-3">{links.map(([title, href]) => { const active = href === "/portal" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm ${active ? "bg-yellow-400 font-bold text-zinc-950" : "text-zinc-400 hover:bg-zinc-800"}`}>{title}</Link>; })}</nav></header><main className="mx-auto max-w-6xl p-4 pb-12 sm:p-6">{children}</main></div>;
}
