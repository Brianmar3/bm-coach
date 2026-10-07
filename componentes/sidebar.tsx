"use client";

import Link from "next/link";
import { BmDashboardIcon, BmStudentsIcon, BmClassesIcon, BmRoutineIcon, BmEvaluationIcon, BmWalletIcon, BmMonthlyIcon, BmSettingsIcon, BmLogoutIcon, BmMenuIcon, type BmIconProps } from "@/componentes/icons";
import type { ComponentType } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useEscapeLayer } from "@/componentes/use-trainer-keyboard-interactions";
import { WorkspaceBrandLogo } from "@/componentes/workspace-brand-logo";
import { useWorkspaceBranding } from "@/componentes/workspace-branding-provider";

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
  const branding = useWorkspaceBranding();

  useEscapeLayer(open, () => setOpen(false), { priority: 50 });

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    setOpen(false);
    router.replace("/admin/login");
    router.refresh();
  }

  const logoutButton = (
      <button type="button" onClick={logout} className="mt-6 flex min-h-11 w-full items-center gap-3 rounded-xl border border-transparent px-3.5 py-2.5 text-left text-sm font-medium text-zinc-500 transition hover:border-red-400/20 hover:bg-red-400/[.06] hover:text-red-300">
        <NavIcon name="logout" />
        Cerrar sesión
      </button>
  );

  const nav = (
    <nav className="mt-5 space-y-1.5" aria-label="Navegación principal del entrenador">
      {links.map(([label, href, icon]) => {
        const active = pathname.startsWith(href);
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${active ? "bg-gradient-to-r from-yellow-400/14 to-yellow-400/[.03] text-yellow-300" : "text-zinc-400 hover:bg-white/[.04] hover:text-zinc-100"}`}>
            {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,.6)]" />}
            <NavIcon name={icon} active={active} />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Abrir menú" aria-expanded={open} className="fixed left-3 top-[calc(env(safe-area-inset-top)+1rem)] z-50 grid h-10 w-10 place-items-center rounded-xl border border-yellow-400/20 bg-zinc-950/95 text-yellow-300 shadow-xl lg:hidden">
        <BmMenuIcon size={20} />
      </button>

      <aside className="trainer-sidebar fixed bottom-0 left-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-30 hidden w-64 flex-col overflow-hidden border-r border-yellow-400/10 bg-[linear-gradient(180deg,#0c0c0f_0%,#050505_100%)] px-4 py-5 lg:flex">
        <p className="shrink-0 px-3 text-[10px] font-bold uppercase tracking-[.22em] text-zinc-600">Gestión diaria</p>
        <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
        <div className="shrink-0">{logoutButton}</div>
      </aside>

      {open && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm lg:hidden" onPointerDown={() => setOpen(false)}>
          <aside role="dialog" aria-modal="true" aria-label="Menú de navegación" className="trainer-sidebar flex h-full w-[min(19rem,88vw)] flex-col overflow-hidden border-r border-yellow-400/15 bg-[linear-gradient(180deg,#111114_0%,#050505_100%)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl" onPointerDown={(event) => event.stopPropagation()}>
            <div className="flex shrink-0 items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <WorkspaceBrandLogo branding={branding} className="h-10 w-10 rounded-xl" compactDefault officialBmMark />
                <div className="min-w-0"><p className="max-w-40 truncate text-sm font-black tracking-wider text-white" title={branding.displayName}>{branding.displayName}</p><p className="text-[9px] text-zinc-500">Panel del entrenador</p></div>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl text-zinc-400 hover:bg-zinc-800" aria-label="Cerrar menú">×</button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">{nav}</div>
            <div className="shrink-0 border-t border-[var(--border)]">{logoutButton}</div>
          </aside>
        </div>
      )}
    </>
  );
}

const navigationIcons: Record<string, ComponentType<BmIconProps>> = {
  dashboard: BmDashboardIcon, students: BmStudentsIcon, calendar: BmClassesIcon,
  routine: BmRoutineIcon, chart: BmEvaluationIcon, wallet: BmWalletIcon,
  monthly: BmMonthlyIcon, settings: BmSettingsIcon, logout: BmLogoutIcon,
};
function NavIcon({ name, active }: { name: string; active?: boolean }) {
  const Icon = navigationIcons[name];
  return Icon ? <Icon size={20} active={active} className="shrink-0" /> : null;
}
