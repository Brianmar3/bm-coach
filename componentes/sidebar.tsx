"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useEscapeLayer } from "@/componentes/use-trainer-keyboard-interactions";

const links = [
  ["Dashboard", "/dashboard", "dashboard"],
  ["Alumnos", "/alumnos", "students"],
  ["Clases", "/clases", "calendar"],
  ["Rutinas", "/rutinas", "routine"],
  ["Evaluaciones", "/evaluaciones", "chart"],
  ["Pagos", "/pagos", "wallet"],
  ["Resumen mensual", "/resumen-mensual", "monthly"],
  ["Configuración", "/configuracion", "settings"],
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEscapeLayer(open, () => setOpen(false), { priority: 50 });

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    setOpen(false);
    router.replace("/admin/login");
    router.refresh();
  }

  const nav = (
    <nav className="mt-5 space-y-1.5" aria-label="Navegación principal del entrenador">
      {links.map(([label, href, icon]) => {
        const active = pathname.startsWith(href);
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${active ? "bg-gradient-to-r from-yellow-400/14 to-yellow-400/[.03] text-yellow-300" : "text-zinc-400 hover:bg-white/[.04] hover:text-zinc-100"}`}>
            {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,.6)]" />}
            <NavIcon name={icon} />
            <span>{label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={logout} className="mt-6 flex min-h-11 w-full items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 text-left text-sm font-medium text-zinc-500 transition hover:border-red-400/20 hover:bg-red-400/[.06] hover:text-red-300">
        <NavIcon name="logout" />
        Cerrar sesión
      </button>
    </nav>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menú" aria-expanded={open} className="fixed left-3 top-[calc(env(safe-area-inset-top)+1rem)] z-50 grid h-10 w-10 place-items-center rounded-xl border border-yellow-400/20 bg-zinc-950/95 text-yellow-300 shadow-xl lg:hidden">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8"><path d="M5 7h14M5 12h14M5 17h14" strokeLinecap="round" /></svg>
      </button>

      <aside className="fixed bottom-0 left-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-30 hidden w-64 border-r border-yellow-400/10 bg-[linear-gradient(180deg,#0c0c0f_0%,#050505_100%)] px-4 py-5 lg:block">
        <p className="px-3 text-[10px] font-bold uppercase tracking-[.22em] text-zinc-600">Gestión diaria</p>
        {nav}
      </aside>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm lg:hidden" onPointerDown={() => setOpen(false)}>
          <aside role="dialog" aria-modal="true" aria-label="Menú de navegación" className="h-full w-[min(19rem,88vw)] overflow-y-auto border-r border-yellow-400/15 bg-[linear-gradient(180deg,#111114_0%,#050505_100%)] p-5 shadow-2xl" onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Image src="/bm-training-mark.png" alt="" width={42} height={42} className="h-10 w-10 rounded-xl object-contain" />
                <div><p className="text-sm font-black tracking-wider text-white">BM <span className="text-yellow-400">TRAINING</span></p><p className="text-[9px] text-zinc-500">Panel del entrenador</p></div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 hover:bg-zinc-800" aria-label="Cerrar menú">×</button>
            </div>
            {nav}
          </aside>
        </div>
      )}
    </>
  );
}

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    dashboard: <path d="M4 13h7V4H4v9Zm9 7h7V11h-7v9ZM4 20h7v-5H4v5Zm9-11h7V4h-7v5Z" />,
    students: <><path d="M16 19v-1.2c0-2.1-1.8-3.8-4-3.8H7c-2.2 0-4 1.7-4 3.8V19M9.5 11A3.5 3.5 0 1 0 9.5 4a3.5 3.5 0 0 0 0 7Z" /><path d="M16 5.2a3.5 3.5 0 0 1 0 6.6M18 14.2c1.8.6 3 2 3 3.8v1" /></>,
    calendar: <><path d="M5 4h14a2 2 0 0 1 2 2v13H3V6a2 2 0 0 1 2-2ZM7 2v4M17 2v4M3 9h18" /><path d="M7 13h2M12 13h2M17 13h.1M7 16h2M12 16h2" /></>,
    routine: <path d="M7 8v8M17 8v8M4 10v4M20 10v4M7 12h10" />,
    chart: <path d="M4 19V5M4 19h16M7 16l4-5 3 2 5-7" />,
    wallet: <path d="M4 6.5h14a2 2 0 0 1 2 2V18H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h12M15 11h5v4h-5a2 2 0 0 1 0-4Z" />,
    monthly: <><path d="M5 4h14a2 2 0 0 1 2 2v14H3V6a2 2 0 0 1 2-2ZM7 2v4M17 2v4M3 9h18" /><path d="M7 13h4M7 16h7M16 13h2" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" /></>,
    logout: <path d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10M14 8l4 4-4 4M9 12h9" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 shrink-0 fill-none stroke-current" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}
