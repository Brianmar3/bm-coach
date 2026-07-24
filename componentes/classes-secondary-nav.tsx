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
  const style = (tab: ClassTab) => `shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${current === tab ? "bg-yellow-400 text-zinc-950" : "text-zinc-300 hover:bg-zinc-800"}`;

  return (
    <nav aria-label="Navegación de Clases" className="flex gap-2 overflow-x-auto p-2 pl-12 lg:pl-2">
      <Link href="/clases" className={style("calendar")}>Calendario semanal</Link>
      <Link href="/asistencias" className={style("attendance")}>Asistencias</Link>
      <Link href="/asistencias?view=history" className={style("history")}>Historial y estadísticas</Link>
    </nav>
  );
}
