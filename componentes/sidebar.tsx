"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const links = [
  ["Dashboard", "/"], ["Alumnos", "/alumnos"], ["Rutinas", "/rutinas"], ["Clases", "/clases"], ["Asistencias", "/asistencias"], ["Evaluaciones", "/evaluaciones"], ["Pagos", "/pagos"], ["Eventos", "/eventos"], ["Configuración", "/configuracion"],
];

export function Sidebar() {
  const pathname = usePathname(); const router = useRouter(); const [open, setOpen] = useState(false);
  if (pathname.startsWith("/portal")) return null;
  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    setOpen(false);
    router.replace("/admin/login");
    router.refresh();
  }
  const nav = <nav className="mt-8 space-y-1">{links.map(([label, href]) => { const active = href === "/" ? pathname === "/" : pathname.startsWith(href); return <Link key={href} href={href} onClick={() => setOpen(false)} className={`block rounded-xl px-4 py-3 text-sm font-medium transition ${active ? "bg-yellow-400 text-zinc-950" : "text-zinc-300 hover:bg-zinc-800 hover:text-yellow-300"}`}>{label}</Link>; })}<button onClick={logout} className="mt-5 w-full rounded-xl border border-zinc-800 px-4 py-3 text-left text-sm font-medium text-zinc-400 transition hover:border-red-400/40 hover:text-red-300">Cerrar sesión</button></nav>;
  return <><button onClick={() => setOpen(true)} aria-label="Abrir menú" className="fixed left-4 top-4 z-30 rounded-xl bg-yellow-400 px-3 py-2 font-bold text-zinc-950 lg:hidden">☰</button><aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-zinc-800 bg-black p-6 lg:block"><Brand />{nav}</aside>{open && <div className="fixed inset-0 z-40 bg-black/70 lg:hidden" onClick={() => setOpen(false)}><aside className="h-full w-72 bg-black p-6" onClick={(event) => event.stopPropagation()}><div className="flex justify-end"><button onClick={() => setOpen(false)} className="text-zinc-400">Cerrar</button></div><Brand />{nav}</aside></div>}</>;
}

function Brand() { return <div className="flex items-center gap-3"><Image src="/logo.png" alt="Logo de BM Coach" width={46} height={46} priority className="h-12 w-12 rounded-xl object-contain" /><div><p className="text-lg font-bold text-white">BM Coach</p><p className="text-xs uppercase tracking-[.18em] text-yellow-400">Gestión deportiva</p></div></div>; }
