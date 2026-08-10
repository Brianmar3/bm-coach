"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type ClassTab = "calendar" | "attendance" | "history";

export function ClassesSecondaryNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current: ClassTab = pathname === "/clases"
    ? "calendar"
    : searchParams.get("view") === "history"
      ? "history"
      : "attendance";
  const style = (tab: ClassTab) => `relative shrink-0 rounded-xl px-4 py-3 text-sm font-semibold transition ${current === tab ? "bg-yellow-400/10 text-yellow-300 after:absolute after:inset-x-4 after:bottom-0 after:h-0.5 after:rounded-full after:bg-yellow-400" : "text-zinc-400 hover:bg-white/[.04] hover:text-zinc-100"}`;

  return (
    <nav aria-label="Navegación de Clases" className="flex gap-1 overflow-x-auto py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link href="/clases" className={style("calendar")}>Calendario semanal</Link>
      <Link href="/asistencias" className={style("attendance")}>Asistencias</Link>
      <Link href="/asistencias?view=history&mode=week" className={style("history")}>Historial y estadísticas</Link>
    </nav>
  );
}
