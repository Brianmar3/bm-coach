"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BmHomeIcon, BmRoutineIcon, BmProfileIcon } from "@/componentes/icons";
import { PortalHeader, PortalNavigationLink, PORTAL_MOBILE_NAV_CLASS } from "@/componentes/portal-visuals";
import type { Student } from "@/types/gestion";

const links = [
  { title: "Inicio", href: "/portal/autogestion", Icon: BmHomeIcon },
  { title: "Rutina", href: "/portal/autogestion/rutina", Icon: BmRoutineIcon },
  { title: "Perfil", href: "/portal/autogestion/perfil", Icon: BmProfileIcon },
];
export function SelfServiceShell({ children, student }: { children: ReactNode; student?: Pick<Student, "firstName" | "lastName" | "profileImageUrl"> }) {
  const pathname = usePathname();
  const active = (href: string) => href === "/portal/autogestion" ? pathname === href : pathname.startsWith(href);
  return <div className="min-h-screen overflow-x-clip bg-[#070707] text-white">
    <PortalHeader homeHref="/portal/autogestion" profileHref="/portal/autogestion/perfil" studentName={student ? `${student.firstName} ${student.lastName}` : "Mi cuenta"} profileImageUrl={student?.profileImageUrl}>
      <nav aria-label="Navegación del portal" className="mx-auto hidden max-w-6xl gap-5 px-5 pb-2 md:flex">{links.map(({ title, href }) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={`border-b-2 px-1 py-2 text-sm font-semibold transition ${active(href) ? "border-yellow-400 text-yellow-400" : "border-transparent text-zinc-500 hover:text-zinc-200"}`}>{title}</Link>)}</nav>
    </PortalHeader>
    <main key={pathname} className="portal-route-enter mx-auto max-w-6xl p-2.5 pb-[calc(var(--portal-bottom-nav-height)+var(--portal-bottom-nav-offset)+var(--portal-bottom-nav-clearance)+env(safe-area-inset-bottom))] sm:p-6 md:pb-12">{children}</main>
    <nav aria-label="Navegación móvil del portal" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }} className={PORTAL_MOBILE_NAV_CLASS}>{links.map((link) => <PortalNavigationLink key={link.href} {...link} active={active(link.href)} />)}</nav>
  </div>;
}
