"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/componentes/sidebar";

export function AppFrame({ children }: { children: ReactNode }) {
  const portal = usePathname().startsWith("/portal");
  return <><Sidebar /><div className={`min-h-full ${portal ? "" : "lg:pl-64"}`}>{children}</div></>;
}
