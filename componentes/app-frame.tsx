"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Sidebar } from "@/componentes/sidebar";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const standalone = pathname.startsWith("/portal") || pathname === "/admin/login";
  return <>{!standalone && <Sidebar />}<div className={`min-h-full ${standalone ? "" : "lg:pl-64"}`}>{children}</div></>;
}
