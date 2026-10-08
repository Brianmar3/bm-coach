"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BmBackIcon } from "@/componentes/icons";

type NavigationHistory = {
  currentEntry?: { index: number };
  entries(): Array<{ url?: string }>;
};

/** Back restores the existing points entry; direct links have a safe parent. */
export function PortalPointsBackLink() {
  const router = useRouter();

  return <Link
    href="/portal/puntos"
    replace
    aria-label="Volver a Puntos y logros"
    className="portal-points-back inline-flex h-11 w-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-zinc-950/55 text-sm font-semibold text-zinc-300 transition hover:border-yellow-400/30 hover:text-[var(--brand-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 md:w-auto md:px-4"
    onNavigate={(event) => {
      const navigation = (window as Window & { navigation?: NavigationHistory }).navigation;
      const previous = navigation?.entries()[(navigation.currentEntry?.index ?? 0) - 1];
      if (!previous?.url) return;
      const url = new URL(previous.url);
      if (url.origin !== window.location.origin || url.pathname !== "/portal/puntos") return;
      event.preventDefault();
      router.back();
    }}
  >
    <BmBackIcon size={20} />
    <span className="hidden md:inline">Volver</span>
  </Link>;
}
