"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type ClassTab = "calendar" | "today" | "attendance" | "history";

export function ClassesSecondaryNav() {
  const pathname = usePathname();
  const [active, setActive] = useState<ClassTab>(pathname === "/asistencias" ? "attendance" : "calendar");

  useEffect(() => {
    function syncFromLocation() {
      if (window.location.pathname === "/asistencias") {
        setActive(window.location.hash === "#historial-estadisticas" ? "history" : "attendance");
      } else {
        setActive(window.location.hash === "#clases-hoy" ? "today" : "calendar");
      }
    }
    window.addEventListener("hashchange", syncFromLocation);
    const sections = [...document.querySelectorAll<HTMLElement>("#calendario-semanal, #clases-hoy, #historial-estadisticas")];
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (visible?.target.id === "calendario-semanal") setActive("calendar");
      if (visible?.target.id === "clases-hoy") setActive("today");
      if (visible?.target.id === "historial-estadisticas") setActive("history");
    }, { rootMargin: "-96px 0px -65% 0px", threshold: [0, 0.2, 0.6] });
    sections.forEach((section) => observer.observe(section));
    return () => { window.removeEventListener("hashchange", syncFromLocation); observer.disconnect(); };
  }, [pathname]);

  const style = (tab: ClassTab) => `shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${active === tab ? "bg-yellow-400 text-zinc-950" : "text-zinc-300 hover:bg-zinc-800"}`;
  return <nav aria-label="Navegación de Clases" className="sticky top-0 z-20 mb-6 -mx-2 flex gap-2 overflow-x-auto border-y border-zinc-800 bg-zinc-950/95 p-2 pl-16 shadow-lg shadow-black/30 backdrop-blur lg:mx-0 lg:rounded-2xl lg:border lg:pl-2">
    <Link href="/clases#calendario-semanal" className={style("calendar")}>Calendario semanal</Link>
    <Link href="/clases#clases-hoy" className={style("today")}>Clases de hoy</Link>
    <Link href="/asistencias" className={style("attendance")}>Asistencias</Link>
    <Link href="/asistencias#historial-estadisticas" className={style("history")}>Historial y estadísticas</Link>
  </nav>;
}
