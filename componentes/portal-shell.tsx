"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import type { StudentServiceType } from "@/types/gestion";

import { StudentNotificationCenter } from "@/componentes/admin-notification-center";
import { AchievementCelebration } from "@/componentes/achievement-celebration";
import { QuickNoteButton } from "@/componentes/quick-log";
import {
  BmClassesIcon,
  BmEvaluationIcon,
  BmHomeIcon,
  BmAppleIcon,
  BmRoutineIcon,
  type BmIconProps,
} from "@/componentes/icons";
import { PortalHeader, PortalNavigationLink, PORTAL_MOBILE_NAV_CLASS } from "@/componentes/portal-visuals";
import { RestTimerIndicator, RestTimerProvider } from "@/componentes/rest-timer-provider";

type PortalLink = readonly [title: string, href: string, icon: ComponentType<BmIconProps>];

const allLinks: PortalLink[] = [
  ["Inicio", "/portal", BmHomeIcon],
  ["Rutina", "/portal/rutina", BmRoutineIcon],
  ["Clases", "/portal/clases", BmClassesIcon],
  ["Nutrición", "/portal/nutricion", BmAppleIcon],
  ["Evaluación", "/portal/evaluaciones", BmEvaluationIcon],
];

export function PortalShell({
  studentName,
  profileImageUrl,
  serviceType,
  hasRoutine,
  children,
}: {
  studentName: string;
  profileImageUrl: string;
  serviceType: StudentServiceType;
  hasRoutine: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [currentProfileImageUrl, setCurrentProfileImageUrl] =
    useState(profileImageUrl);
  useEffect(() => {
    const update = (event: Event) => {
      const detail = (event as CustomEvent<{ photoUrl?: string }>).detail;
      setCurrentProfileImageUrl(detail?.photoUrl ?? "");
    };
    window.addEventListener("bm:profile-photo-updated", update);
    return () => window.removeEventListener("bm:profile-photo-updated", update);
  }, []);
  const links = allLinks.filter(([, href]) => {
    if (href === "/portal/clases") return serviceType !== "PERSONALIZED";
    if (href === "/portal/rutina") return serviceType !== "CLASSES" || hasRoutine;
    return true;
  });
  const isHome = pathname === "/portal";
  const showNavigationQuickLog = serviceType !== "MIXED";
  const mobileQuickLogIndex = Math.ceil(links.length / 2);
  const isLinkActive = (href: string) => {
    if (href === "/portal/clases" && (pathname.startsWith("/portal/registro") || pathname.startsWith("/portal/asistencias"))) {
      return true;
    }
    if (
      href === "/portal/rutina" &&
      ["/portal/entrenamiento", "/portal/historial", "/portal/comentarios", "/portal/progreso"].some(
        (route) => pathname.startsWith(route),
      )
    ) {
      return true;
    }
    return href === "/portal" ? pathname === href : pathname.startsWith(href);
  };
  const linkStyle = (href: string) => {
    return isLinkActive(href)
      ? "text-yellow-400"
      : "text-zinc-500 hover:text-zinc-200";
  };

  return <RestTimerProvider>
    <div className={`${isHome ? "" : "min-h-screen"} overflow-x-clip bg-[#070707] text-white`}>
      <AchievementCelebration />
      <PortalHeader studentName={studentName} profileImageUrl={currentProfileImageUrl} actions={<StudentNotificationCenter />}>
        <nav
          aria-label="Navegación del portal"
          className="mx-auto hidden max-w-6xl gap-5 px-5 pb-2 md:flex"
        >
          {links.map(([title, href]) => (
            <Link
              key={href}
              href={href}
              className={`border-b-2 px-1 py-2 text-sm font-semibold transition ${linkStyle(
                href,
              )} ${
                linkStyle(href) === "text-yellow-400"
                  ? "border-yellow-400"
                  : "border-transparent"
              }`}
            >
              {title}
            </Link>
          ))}
          {showNavigationQuickLog && <QuickNoteButton placement="inline" />}
        </nav>
      </PortalHeader>

      <main key={pathname} className="portal-route-enter mx-auto max-w-6xl p-2.5 pb-[calc(var(--portal-bottom-nav-height)+var(--portal-bottom-nav-offset)+var(--portal-bottom-nav-clearance)+env(safe-area-inset-bottom))] sm:p-6 md:pb-12">
        {children}
      </main>

      <RestTimerIndicator />

      <nav
        aria-label="Navegación móvil del portal"
        style={{ gridTemplateColumns: `repeat(${links.length + (showNavigationQuickLog ? 1 : 0)}, minmax(0, 1fr))` }}
        className={PORTAL_MOBILE_NAV_CLASS}
      >
        {links.map(([title, href, Icon], index) => {
          const active = isLinkActive(href);
          return (
            <span key={href} className="contents">
            {showNavigationQuickLog && index === mobileQuickLogIndex && <QuickNoteButton placement="navigation" />}
            <PortalNavigationLink title={title} href={href} Icon={Icon} active={active} />
            </span>
          );
        })}
        {showNavigationQuickLog && mobileQuickLogIndex === links.length && <QuickNoteButton placement="navigation" />}
      </nav>
    </div>
  </RestTimerProvider>;
}
