import Image from "next/image";
import Link from "next/link";
import type { ReactNode, ComponentType } from "react";
import type { BmIconProps } from "@/componentes/icons";
import { DEFAULT_PROFILE_AVATAR } from "@/lib/profile-avatars";

export function PortalProfileAvatar({ src, name }: { src?: string; name: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- same uploaded/bundled avatar rendering as the existing profile
  return <div className="size-28 shrink-0 overflow-hidden rounded-full border border-yellow-300/65 bg-black shadow-[0_0_28px_rgba(250,204,21,.14)] sm:size-40"><img src={src || DEFAULT_PROFILE_AVATAR.src} alt={`Avatar de ${name}`} className="h-full w-full object-cover" /></div>;
}

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


export function PortalHeader({ homeHref = "/portal", profileHref = "/portal/perfil", studentName, profileImageUrl = "", actions, children }: { homeHref?: string; profileHref?: string; studentName: string; profileImageUrl?: string; actions?: ReactNode; children?: ReactNode }) {
  return <header className="sticky top-0 z-30 overflow-hidden rounded-b-[24px] border-b border-yellow-400/20 bg-black/95 pt-[env(safe-area-inset-top)] shadow-[0_8px_30px_rgba(0,0,0,.35)] backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-6xl min-w-0 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5">
          <Link
            href={homeHref}
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
            {actions}
            <Link
              href={profileHref}
              className="group flex min-h-11 min-w-11 items-center gap-2 rounded-full p-1 transition hover:bg-zinc-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-300 sm:pr-3"
              aria-label={`Abrir perfil de ${studentName}`}
            >
              <Image
                src={profileImageUrl || DEFAULT_PROFILE_AVATAR.src}
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
  {children}</header>;
}
export const PORTAL_MOBILE_NAV_CLASS = "fixed bottom-[calc(env(safe-area-inset-bottom)+var(--portal-bottom-nav-offset))] left-5 right-5 z-40 mx-auto grid h-[var(--portal-bottom-nav-height)] max-w-[30rem] rounded-[30px] border border-white/[.09] bg-black/85 p-1.5 shadow-[0_18px_45px_rgba(0,0,0,.68),inset_0_1px_0_rgba(255,255,255,.03)] backdrop-blur-xl md:hidden";
export const PORTAL_STAT_CARD_CLASS = "portal-home-stat portal-home-interactive group relative min-h-[7.75rem] min-w-0 overflow-hidden rounded-[18px] border border-yellow-400/30 bg-[linear-gradient(145deg,#151515,#090909)] p-3.5 shadow-[0_12px_28px_rgba(0,0,0,.25)] transition hover:border-yellow-400/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300 min-[390px]:p-4";
export function PortalNavigationLink({ title, href, Icon, active }: { title: string; href: string; Icon: ComponentType<BmIconProps>; active: boolean }) {
  return <Link
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
            </Link>;
}
export function PortalHeroFrame({ children }: { children: ReactNode }) {
  return <header className="portal-home-enter portal-home-hero relative overflow-hidden rounded-[26px] border border-yellow-400/25 bg-[radial-gradient(circle_at_86%_12%,rgba(250,204,21,.055),transparent_30%),linear-gradient(145deg,#171717,#090909_72%)] px-5 py-4 shadow-[0_18px_45px_rgba(0,0,0,.34)] min-[390px]:px-6 sm:p-8">{children}</header>;
}
export function PortalRoutineFrame({ children }: { children: ReactNode }) {
  return <section className="relative overflow-hidden rounded-[22px] border border-yellow-400/25 bg-[radial-gradient(circle_at_88%_18%,rgba(250,204,21,.065),transparent_34%),linear-gradient(145deg,#151515,#090909)] p-4 shadow-[0_16px_36px_rgba(0,0,0,.3)] sm:p-5">{children}</section>;
}
export function PortalProfileFrame({ children }: { children: ReactNode }) {
  return <section className="relative rounded-[28px] border border-yellow-400/25 bg-[radial-gradient(circle_at_12%_12%,rgba(250,204,21,.08),transparent_30%),linear-gradient(145deg,#151515,#090909)] p-5 shadow-[0_18px_44px_rgba(0,0,0,.34)] sm:p-7">{children}</section>;
}
