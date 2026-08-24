"use client";

import Image from "next/image";
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
  BmNutritionIcon,
  BmRoutineIcon,
  type BmIconProps,
} from "@/componentes/icons";
import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatars";

type PortalLink = readonly [title: string, href: string, icon: ComponentType<BmIconProps>];

const allLinks: PortalLink[] = [
  ["Inicio", "/portal", BmHomeIcon],
  ["Rutina", "/portal/rutina", BmRoutineIcon],
  ["Clases", "/portal/clases", BmClassesIcon],
  ["Nutrición", "/portal/nutricion", BmNutritionIcon],
  ["Evaluación", "/portal/evaluaciones", BmEvaluationIcon],
];

function BrandMark() {
  return (
    <Image
      src="/bm-training-mark.png"
      alt=""
      width={44}
      height={44}
      priority
      className="h-9 w-9 shrink-0 rounded-xl object-contain sm:h-11 sm:w-11"
    />
  );
}

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

  return (
    <div className="min-h-screen overflow-x-clip bg-[#070707] text-white">
      <AchievementCelebration />
      <header className="sticky top-0 z-30 overflow-hidden rounded-b-[24px] border-b border-yellow-400/20 bg-black/95 pt-[env(safe-area-inset-top)] shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl min-w-0 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5">
          <Link
            href="/portal"
            className="flex min-w-0 items-center gap-2 sm:gap-3"
            aria-label="Ir al inicio de BM Training"
          >
            <BrandMark />
            <span className="min-w-0">
              <span className="block whitespace-nowrap text-xs font-black tracking-[.08em] text-white min-[390px]:text-sm sm:text-base sm:tracking-[.12em]">
                BM <span className="text-yellow-400">TRAINING</span>
              </span>
              <span className="block max-w-[8.5rem] text-[8px] leading-tight tracking-wide text-zinc-400 min-[390px]:max-w-[10.5rem] min-[390px]:text-[9px] sm:max-w-none sm:text-[10px]">
                Gestión, entrenamiento y seguimiento
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <StudentNotificationCenter />
            <Link
              href="/portal/perfil"
              className="group flex min-h-11 min-w-11 items-center gap-2 rounded-full p-1 transition hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 sm:pr-3"
              aria-label={`Abrir perfil de ${studentName}`}
            >
              <Image
                src={currentProfileImageUrl || DEFAULT_PROFILE_AVATAR.src}
                alt=""
                width={36}
                height={36}
                unoptimized
                className="h-9 w-9 shrink-0 rounded-full border border-yellow-400/25 object-cover"
              />
              <span className="hidden min-w-0 md:block">
                <span className="block max-w-40 truncate text-xs font-semibold text-zinc-200">
                  {studentName}
                </span>
                <span className="mt-0.5 block text-[10px] text-zinc-500 group-hover:text-yellow-300">
                  Ver perfil <span className="text-yellow-400">›</span>
                </span>
              </span>
            </Link>
          </div>
        </div>

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
      </header>

      <main key={pathname} className="portal-route-enter mx-auto max-w-6xl p-2.5 pb-[calc(env(safe-area-inset-bottom)+8.25rem)] sm:p-6 md:pb-12">
        {children}
      </main>

      <nav
        aria-label="Navegación móvil del portal"
        style={{ gridTemplateColumns: `repeat(${links.length + (showNavigationQuickLog ? 1 : 0)}, minmax(0, 1fr))` }}
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] left-5 right-5 z-40 mx-auto grid h-[76px] max-w-[30rem] rounded-[30px] border border-white/[.09] bg-black/85 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,.68),inset_0_1px_0_rgba(255,255,255,.03)] backdrop-blur-xl md:hidden"
      >
        {links.map(([title, href, Icon], index) => {
          const active = isLinkActive(href);
          return (
            <span key={href} className="contents">
            {showNavigationQuickLog && index === mobileQuickLogIndex && <QuickNoteButton placement="navigation" />}
            <Link
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group relative mx-0.5 flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-full border text-[10px] font-bold transition-[color,background-color,border-color,box-shadow,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-1 focus-visible:ring-offset-black ${
                active
                  ? "border-yellow-400/20 bg-white/[.035] text-yellow-300 shadow-[inset_0_1px_0_rgba(255,255,255,.035)]"
                  : "border-transparent bg-transparent text-zinc-500 hover:text-zinc-200"
              }`}
            >
              <Icon
                size={20}
                className={`transition-[color,filter,transform] duration-200 ${
                  active
                    ? "portal-nav-active-icon scale-105 text-yellow-300"
                    : "text-zinc-500 group-hover:text-zinc-300"
                }`}
              />
              <span className="max-w-full truncate px-0.5">{title}</span>
              {active && (
                <span
                  aria-hidden="true"
                  className="absolute bottom-1.5 h-0.5 w-4 rounded-full bg-yellow-300"
                />
              )}
            </Link>
            </span>
          );
        })}
        {showNavigationQuickLog && mobileQuickLogIndex === links.length && <QuickNoteButton placement="navigation" />}
      </nav>
    </div>
  );
}
