"use client";

import Link from "next/link";

import { AdminNotificationCenter } from "@/componentes/admin-notification-center";
import { WorkspaceBrandLogo } from "@/componentes/workspace-brand-logo";
import { useWorkspaceBranding } from "@/componentes/workspace-branding-provider";

export function AdminTopbar() {
  const branding = useWorkspaceBranding();

  return (
    <header className="admin-topbar fixed inset-x-0 top-0 z-40 h-[calc(env(safe-area-inset-top)+4.5rem)] border-b border-yellow-400/10 bg-[var(--nav-bg)] pt-[env(safe-area-inset-top)] shadow-[0_12px_40px_rgba(0,0,0,.12)] backdrop-blur-xl">
      <div className="flex h-[4.5rem] min-w-0 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 pl-12 sm:gap-3 lg:pl-0"
          aria-label={`Ir al Dashboard de ${branding.displayName}`}
        >
          <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-yellow-400/20 bg-zinc-950 shadow-[0_0_24px_rgba(250,204,21,.08)] sm:h-11 sm:w-11">
            <WorkspaceBrandLogo branding={branding} className="h-9 w-9 sm:h-10 sm:w-10" compactDefault officialBmMark />
          </span>
          <span className="min-w-0">
            <span className="block max-w-[9rem] truncate text-xs font-black tracking-[.08em] text-white min-[390px]:max-w-[11rem] min-[390px]:text-sm sm:max-w-[16rem] sm:text-base sm:tracking-[.12em]" title={branding.displayName}>
              {branding.displayName}
            </span>
            <span className="block max-w-[8.5rem] text-[8px] leading-tight tracking-wide text-zinc-400 min-[390px]:max-w-[10rem] min-[390px]:text-[9px] sm:max-w-none sm:text-[10px]">
              Gestión, entrenamiento y seguimiento
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center">
          <AdminNotificationCenter />
        </div>
      </div>
    </header>
  );
}
