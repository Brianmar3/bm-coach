"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useBrowserStore } from "@/lib/browser-store";
import type { CoachSettings } from "@/types/gestion";

export function AdminTopbar() {
  const router = useRouter();
  const { items } = useBrowserStore<CoachSettings>("bm-coach-settings", []);
  const coachName = items[0]?.coachName?.trim() || "Entrenador";
  const initials = coachName.split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "BM";

  async function logout() {
    await fetch("/api/admin/auth/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  return (
    <header className="admin-topbar fixed inset-x-0 top-0 z-40 h-[calc(env(safe-area-inset-top)+4.5rem)] border-b border-yellow-400/10 bg-black/95 pt-[env(safe-area-inset-top)] shadow-[0_12px_40px_rgba(0,0,0,.35)] backdrop-blur-xl">
      <div className="flex h-[4.5rem] items-center justify-between gap-3 px-4 sm:px-6">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3 pl-12 lg:pl-0" aria-label="Ir al Dashboard de BM Training">
          <span className="relative grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border border-yellow-400/20 bg-zinc-950 shadow-[0_0_24px_rgba(250,204,21,.08)]">
            <Image src="/bm-training-mark.png" alt="" width={44} height={44} priority className="h-10 w-10 object-contain" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-black tracking-[.12em] text-white sm:text-base">
              BM <span className="text-yellow-400">TRAINING</span>
            </span>
            <span className="hidden truncate text-[10px] tracking-wide text-zinc-400 min-[390px]:block">
              Gestión, entrenamiento y seguimiento
            </span>
          </span>
        </Link>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <Link href="/configuracion" className="group flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-white/5 sm:pr-3">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-yellow-400/30 bg-gradient-to-br from-zinc-800 to-black text-xs font-black text-yellow-300">
              {initials}
            </span>
            <span className="hidden text-left sm:block">
              <span className="block max-w-36 truncate text-xs font-semibold text-zinc-100">{coachName}</span>
              <span className="block text-[10px] text-zinc-500 group-hover:text-yellow-300">Ver configuración</span>
            </span>
          </Link>
          <button type="button" onClick={logout} className="grid h-10 w-10 place-items-center rounded-xl border border-zinc-800 text-zinc-400 transition hover:border-red-400/30 hover:bg-red-400/10 hover:text-red-300" aria-label="Cerrar sesión" title="Cerrar sesión">
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5 fill-none stroke-current" strokeWidth="1.8">
              <path d="M10 5H6.8A1.8 1.8 0 0 0 5 6.8v10.4A1.8 1.8 0 0 0 6.8 19H10M14 8l4 4-4 4M9 12h9" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}
