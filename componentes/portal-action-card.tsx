import Link from "next/link";
import type { ReactNode } from "react";

export function PortalActionCard({ href, title, subtitle, icon, ariaLabel }: {
  href: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  ariaLabel: string;
}) {
  return <Link href={href} aria-label={ariaLabel} className="grid min-h-20 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-white/[.08] bg-[#151517] p-3.5 outline-none transition hover:border-yellow-400/25 hover:bg-[#18181a] focus-visible:ring-2 focus-visible:ring-yellow-300 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070707]">
    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl border border-yellow-400/20 bg-yellow-400/[.05] text-yellow-300">{icon}</span>
    <span className="min-w-0"><strong className="block text-sm font-bold text-zinc-100 sm:text-base">{title}</strong><small className="mt-1 block text-xs leading-relaxed text-zinc-400 sm:text-sm">{subtitle}</small></span>
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-5 shrink-0 fill-none stroke-zinc-500" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m7.5 4.5 5 5.5-5 5.5" /></svg>
  </Link>;
}
