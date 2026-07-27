"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BmTrainingSplash } from "@/componentes/bm-training-splash";
import { ClassesModuleHeader } from "@/componentes/classes-module-header";
import { Sidebar } from "@/componentes/sidebar";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const standalone = pathname.startsWith("/portal") || pathname === "/admin/login";
  const classesModule = pathname === "/clases" || pathname === "/asistencias";
  return (
    <BmTrainingSplash>
      {!standalone && <Sidebar />}
      <div className={`min-h-full ${standalone ? "" : "pt-[calc(env(safe-area-inset-top)+3.5rem)] lg:pl-64 lg:pt-0"}`}>
        {classesModule && <ClassesModuleHeader />}
        {children}
      </div>
    </BmTrainingSplash>
  );
}
