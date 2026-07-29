"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminTopbar } from "@/componentes/admin-topbar";
import { BmTrainingSplash } from "@/componentes/bm-training-splash";
import { ClassesModuleHeader } from "@/componentes/classes-module-header";
import { Sidebar } from "@/componentes/sidebar";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const standalone = pathname.startsWith("/portal") || pathname === "/admin/login";
  const classesModule = pathname === "/clases" || pathname === "/asistencias";
  return (
    <BmTrainingSplash>
      {standalone ? children : (
        <div className="admin-panel min-h-full bg-black text-white">
          <AdminTopbar />
          <Sidebar />
          <div className="min-h-full pt-[calc(env(safe-area-inset-top)+4.5rem)] lg:pl-64">
            {classesModule && <ClassesModuleHeader />}
            {children}
          </div>
        </div>
      )}
    </BmTrainingSplash>
  );
}
