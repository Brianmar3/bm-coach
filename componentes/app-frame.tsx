"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminTopbar } from "@/componentes/admin-topbar";
import { BmBootReady } from "@/componentes/bm-boot-ready";
import { ClassesModuleHeader } from "@/componentes/classes-module-header";
import { Sidebar } from "@/componentes/sidebar";
import { TrainerCommandPalette } from "@/componentes/trainer-command-palette";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const standalone = pathname.startsWith("/portal") || pathname === "/admin/login";
  const classesModule = pathname === "/clases" || pathname === "/asistencias";
  return (
    <>
      <BmBootReady />
      {standalone ? children : (
        <div className="admin-panel min-h-full max-w-full overflow-x-clip bg-black text-white">
          <AdminTopbar />
          <Sidebar />
          <TrainerCommandPalette />
          <div className="min-h-full min-w-0 max-w-full pt-[calc(env(safe-area-inset-top)+4.5rem)] lg:pl-64">
            {classesModule && <ClassesModuleHeader />}
            {children}
          </div>
        </div>
      )}
    </>
  );
}
