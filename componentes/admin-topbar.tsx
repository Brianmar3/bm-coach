"use client";

import Image from "next/image";
import Link from "next/link";

import { AdminNotificationCenter } from "@/componentes/admin-notification-center";
import { useBrowserStore } from "@/lib/browser-store";
import type { CoachSettings } from "@/types/gestion";

export function AdminTopbar() {
  const { items } = useBrowserStore<CoachSettings>("bm-coach-settings", []);
  const coachName = items[0]?.coachName?.trim() || "Entrenador";
  const initials =
    coachName
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "BM";

  return (
    <header className="admin-topbar fixed inset-x-0 top-0 z-40 h-[calc(env(safe-area-inset-top)+4.5rem)] border-b border-yellow-400/10 bg-black/95 pt-[env(safe-area-inset-top)] shadow-[0_12px_40px_rgba(0,0,0,.35)] backdrop-blur-xl">
      <div className="flex h-[4.5rem] min-w-0 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 pl-12 sm:gap-3 lg:pl-0"
          aria-label="Ir al Dashboard de BM Training"
        >
          <span className="relative grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-yellow-400/20 bg-zinc-950 shadow-[0_0_24px_rgba(250,204,21,.08)] sm:h-11 sm:w-11">
            <Image
              src="/bm-training-mark.png"
              alt=""
              width={44}
              height={44}
              priority
              className="h-9 w-9 object-contain sm:h-10 sm:w-10"
            />
          </span>
          <span className="min-w-0">
            <span className="block whitespace-nowrap text-xs font-black tracking-[.08em] text-white min-[390px]:text-sm sm:text-base sm:tracking-[.12em]">
              BM <span className="text-yellow-400">TRAINING</span>
            </span>
            <span className="block max-w-[8.5rem] text-[8px] leading-tight tracking-wide text-zinc-400 min-[390px]:max-w-[10rem] min-[390px]:text-[9px] sm:max-w-none sm:text-[10px]">
              Gestión, entrenamiento y seguimiento
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <AdminNotificationCenter />
          <Link
            href="/configuracion"
            className="group flex items-center gap-2 rounded-xl p-1 transition hover:bg-white/5 sm:pr-3"
            aria-label={`Abrir perfil y configuración de ${coachName}`}
          >
            <span className="grid h-9 w-9 place-items-center rounded-full border border-yellow-400/30 bg-gradient-to-br from-zinc-800 to-black text-xs font-black text-yellow-300">
              {initials}
            </span>
            <span className="hidden text-left md:block">
              <span className="block max-w-36 truncate text-xs font-semibold text-zinc-100">
                {coachName}
              </span>
              <span className="block text-[10px] text-zinc-500 group-hover:text-yellow-300">
                Ver configuración
              </span>
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}
