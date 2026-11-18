"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType, type TouchEvent } from "react";
import { BmDashboardIcon, BmStudentsIcon, BmClassesIcon, BmRoutineIcon, BmEvaluationIcon, BmWalletIcon, BmMonthlyIcon, BmSettingsIcon, BmLogoutIcon, BmChevronRightIcon, type BmIconProps } from "@/componentes/icons";
import { useDialogKeyboard } from "@/componentes/keyboard-dialog";
import styles from "./trainer-mobile-navigation.module.css";

const links = [
  ["Dashboard", "/dashboard", "dashboard"], ["Alumnos", "/alumnos", "students"],
  ["Clases", "/clases", "calendar"], ["Rutinas", "/rutinas", "routine"],
  ["Evaluaciones", "/evaluaciones", "chart"], ["Pagos", "/pagos", "wallet"],
  ["Resumen mensual", "/resumen-mensual", "monthly"], ["Configuración", "/configuracion", "settings"],
] as const;
const primary = [
  ["Inicio", "/dashboard", "dashboard"], ["Alumnos", "/alumnos", "students"],
  ["Clases", "/clases", "calendar"], ["Rutinas", "/rutinas", "routine"],
] as const;
const secondary = links.slice(4);

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const touchStart = useRef<number | null>(null);
  const historyEntry = useRef(false);
  const closeTimer = useRef<number | null>(null);
  const moreActive = secondary.some(([, href]) => pathname.startsWith(href));

  function hideMore() {
    if (closeTimer.current !== null) return;
    setClosing(true);
    closeTimer.current = window.setTimeout(() => { setOpen(false); setClosing(false); closeTimer.current = null; }, 180);
  }
  function closeMore() {
    if (historyEntry.current) { historyEntry.current = false; window.history.back(); }
    hideMore();
  }
  function openMore() {
    window.history.pushState({ ...window.history.state, bmTrainerMore: true }, "");
    historyEntry.current = true;
    setOpen(true);
  }
  function navigateFromMore() {
    historyEntry.current = false;
    window.history.replaceState({ ...window.history.state, bmTrainerMore: false }, "");
    setOpen(false);
  }
  const dialogKeyboard = useDialogKeyboard(dialogRef, open, closeMore, { priority: 70 });

  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.dataset.trainerMore = "open";
    const onBack = () => { historyEntry.current = false; hideMore(); };
    window.addEventListener("popstate", onBack);
    return () => { document.body.style.overflow = overflow; delete document.documentElement.dataset.trainerMore; window.removeEventListener("popstate", onBack); };
  }, [open]);

  useEffect(() => () => { if (closeTimer.current !== null) window.clearTimeout(closeTimer.current); }, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => { document.documentElement.dataset.trainerKeyboard = viewport.height < window.innerHeight - 150 ? "open" : "closed"; };
    update(); viewport.addEventListener("resize", update);
    return () => { viewport.removeEventListener("resize", update); delete document.documentElement.dataset.trainerKeyboard; };
  }, []);

  async function logout() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const response = await fetch("/api/admin/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Logout failed");
      if (open) navigateFromMore();
      router.replace("/admin/login"); router.refresh();
    } catch { setSigningOut(false); setSignOutError(true); }
  }

  return <>
    <aside className="trainer-sidebar fixed bottom-0 left-0 top-[calc(env(safe-area-inset-top)+4.5rem)] z-30 hidden w-64 flex-col overflow-hidden border-r border-yellow-400/10 bg-[linear-gradient(180deg,#0c0c0f_0%,#050505_100%)] px-4 py-5 lg:flex">
      <p className="shrink-0 px-3 text-[10px] font-bold uppercase tracking-[.22em] text-zinc-600">Gestión diaria</p>
      <nav className="mt-5 min-h-0 flex-1 space-y-1.5 overflow-y-auto" aria-label="Navegación principal del entrenador">
        {links.map(([label, href, icon]) => { const active = pathname.startsWith(href); return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition ${active ? "bg-gradient-to-r from-yellow-400/14 to-yellow-400/[.03] text-yellow-300" : "text-zinc-400 hover:bg-white/[.04] hover:text-zinc-100"}`}>
          {active && <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,.6)]" />}
          <NavIcon name={icon} active={active} size={20} /><span>{label}</span>
        </Link>; })}
      </nav>
      <button type="button" onClick={logout} disabled={signingOut} className="mt-6 flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-zinc-500 hover:bg-red-400/[.06] hover:text-red-300"><BmLogoutIcon size={20} />Cerrar sesión</button>
    </aside>

    <nav className={styles.nav} aria-label="Navegación móvil del entrenador">
      {primary.map(([label, href, icon]) => { const active = (pathname.startsWith(href) || (href === "/clases" && pathname.startsWith("/asistencias"))) && !open; return <Link key={href} href={href} aria-current={active ? "page" : undefined} onClick={() => { if (open) navigateFromMore(); }} className={`${styles.navItem} ${active ? styles.navActive : ""}`}><NavIcon name={icon} active={active} /><span>{label}</span></Link>; })}
      <button ref={moreRef} type="button" aria-label="Más" aria-expanded={open} aria-controls="trainer-more-panel" onClick={() => open ? closeMore() : openMore()} className={`${styles.navItem} ${open || moreActive ? styles.navActive : ""}`}><MoreIcon /><span>Más</span></button>
    </nav>

    {open && <div className={`${styles.backdrop} ${closing ? styles.backdropClosing : ""}`} onPointerDown={(event) => { if (event.target === event.currentTarget) closeMore(); }}>
      <section id="trainer-more-panel" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="trainer-more-title" tabIndex={-1} className={`${styles.sheet} ${closing ? styles.sheetClosing : ""}`} onKeyDown={dialogKeyboard} onTouchStart={(event: TouchEvent) => { const finger = event.touches[0]; touchStart.current = dialogRef.current?.scrollTop === 0 && finger && finger.clientY - dialogRef.current.getBoundingClientRect().top < 80 ? finger.clientY : null; }} onTouchEnd={(event: TouchEvent) => { if (touchStart.current !== null && event.changedTouches[0]?.clientY - touchStart.current > 90) closeMore(); touchStart.current = null; }}>
        <div className={styles.handle} aria-hidden="true" />
        <div className={styles.sheetHeading}><span className={styles.headingIcon}><MoreGridIcon /></span><div><h2 id="trainer-more-title">Más</h2><p>Herramientas y configuración</p></div></div>
        <div className={styles.sheetLinks}>{secondary.map(([label, href, icon]) => <Link key={href} href={href} onClick={navigateFromMore} className={styles.sheetLink}><NavIcon name={icon} /><span>{label}</span><BmChevronRightIcon size={18} className={styles.chevron} /></Link>)}</div>
        <div className={styles.separator} />
        <button type="button" disabled={signingOut} onClick={logout} className={styles.sheetLink}><BmLogoutIcon size={22} /><span>{signingOut ? "Cerrando sesión…" : "Cerrar sesión"}</span></button>
        {signOutError && <p role="alert" className="mt-2 text-sm text-red-300">No se pudo cerrar sesión. Intentá nuevamente.</p>}
      </section>
    </div>}
  </>;
}

const navigationIcons: Record<string, ComponentType<BmIconProps>> = { dashboard: BmDashboardIcon, students: BmStudentsIcon, calendar: BmClassesIcon, routine: BmRoutineIcon, chart: BmEvaluationIcon, wallet: BmWalletIcon, monthly: BmMonthlyIcon, settings: BmSettingsIcon };
function NavIcon({ name, active, size = 22 }: { name: string; active?: boolean; size?: number }) { const Icon = navigationIcons[name]; return Icon ? <Icon size={size} active={active} className="shrink-0" /> : null; }
function MoreIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" className="h-[22px] w-[22px]"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>; }
function MoreGridIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>; }
