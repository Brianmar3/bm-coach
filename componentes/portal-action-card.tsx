import Link from "next/link";
import type { ReactNode } from "react";

export function PortalActionCard({ href, title, subtitle, icon, ariaLabel }: {
  href: string;
  title: string;
  subtitle: string;
  icon: ReactNode;
  ariaLabel: string;
}) {
  return <Link href={href} aria-label={ariaLabel} className="grid min-h-20 w-full min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-yellow-400/15 bg-[#151517] p-3.5 outline-none transition hover:border-yellow-400/30 focus-visible:ring-2 focus-visible:ring-yellow-300">
    <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-2xl border border-yellow-400/20 bg-yellow-400/[.05] text-yellow-300">{icon}</span>
    <span className="min-w-0"><strong className="block text-sm font-bold text-zinc-100 sm:text-base">{title}</strong><small className="mt-1 block text-xs leading-relaxed text-zinc-500 sm:text-sm">{subtitle}</small></span>
    <span aria-hidden="true" className="shrink-0 text-2xl text-zinc-600">›</span>
  </Link>;
}
