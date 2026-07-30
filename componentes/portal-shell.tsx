"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import type { StudentServiceType } from "@/types/gestion";

import { StudentNotificationCenter } from "@/componentes/admin-notification-center";
import { AchievementCelebration } from "@/componentes/achievement-celebration";

type PortalLink = readonly [title: string, href: string, icon: string];

const allLinks: PortalLink[] = [
  ["Inicio", "/portal", "⌂"],
  ["Rutina", "/portal/rutina", "◫"],
  ["Clases", "/portal/clases", "▷"],
  ["Evaluaciones", "/portal/evaluaciones", "◇"],
  ["Perfil", "/portal/perfil", "○"],
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
  if (serviceType === "PERSONALIZED") {
    links.splice(links.length - 1, 0, ["Registros", "/portal/registro", "✎"]);
  }
  const initials = studentName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const linkStyle = (href: string) => {
    const active =
      href === "/portal" ? pathname === href : pathname.startsWith(href);
    return active
      ? "text-yellow-400"
      : "text-zinc-500 hover:text-zinc-200";
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#070707] text-white">
      <AchievementCelebration />
      <header className="sticky top-0 z-30 border-b border-yellow-400/10 bg-black/95 pt-[env(safe-area-inset-top)] shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur-xl">
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
              className="group flex min-w-0 items-center gap-2 rounded-xl p-1 transition hover:bg-zinc-900 sm:pr-3"
              aria-label={`Abrir perfil de ${studentName}`}
            >
              {currentProfileImageUrl ? (
                <Image
                  src={currentProfileImageUrl}
                  alt=""
                  width={36}
                  height={36}
                  unoptimized
                  className="h-9 w-9 shrink-0 rounded-full border border-yellow-400/30 object-cover"
                />
              ) : (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-yellow-400/40 bg-black text-[10px] font-black text-yellow-300">
                  {initials || "BM"}
                </span>
              )}
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
        </nav>
      </header>

      <main className="mx-auto max-w-6xl p-3 pb-28 sm:p-6 md:pb-12">
        {children}
      </main>

      <nav
        aria-label="Navegación móvil del portal"
        style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
        className="fixed inset-x-0 bottom-0 z-40 grid border-t border-yellow-400/10 bg-black/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_rgba(0,0,0,.45)] backdrop-blur md:hidden"
      >
        {links.map(([title, href, icon]) => {
          const active =
            href === "/portal" ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`relative flex min-h-16 flex-col items-center justify-center gap-1 text-[10px] font-bold transition focus:outline-none focus:ring-2 focus:ring-inset focus:ring-yellow-400 ${linkStyle(
                href,
              )}`}
            >
              <span aria-hidden="true" className="text-lg leading-none">
                {icon}
              </span>
              {title}
              {active && (
                <span className="absolute bottom-1 h-0.5 w-5 rounded-full bg-yellow-400" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
