"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AdminTopbar } from "@/componentes/admin-topbar";
import { BmBootReady } from "@/componentes/bm-boot-ready";
import { ClassesModuleHeader } from "@/componentes/classes-module-header";
import { Sidebar } from "@/componentes/sidebar";
import { TrainerCommandPalette } from "@/componentes/trainer-command-palette";
import { WorkspaceBrandingProvider } from "@/componentes/workspace-branding-provider";
import { NativePushOnboarding } from "@/componentes/native-push-onboarding";

export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const standalone = pathname === "/privacidad" || pathname === "/eliminar-cuenta" || pathname.startsWith("/portal") || pathname === "/admin/login" || pathname === "/master" || pathname.startsWith("/platform") || pathname.startsWith("/trainer/invite/") || pathname.startsWith("/trainer/reset-password/") || pathname === "/trainer/onboarding" || pathname.startsWith("/join/student/");
  const classesModule = pathname === "/clases" || pathname === "/asistencias";
  const viewportStickyPage = pathname === "/resumen-mensual";
  return (
    <>
      <BmBootReady />
      {standalone ? children : (
        <WorkspaceBrandingProvider><div className={`admin-panel min-h-full max-w-full bg-[var(--background)] text-[var(--foreground)] ${viewportStickyPage ? "admin-panel--viewport-sticky" : "overflow-x-clip"}`}>
          <AdminTopbar />
          <Sidebar />
          <TrainerCommandPalette />
          <NativePushOnboarding audience="trainer" />
          <div className="min-h-full min-w-0 max-w-full pt-[calc(env(safe-area-inset-top)+4.5rem)] lg:pl-64">
            {classesModule && <ClassesModuleHeader />}
            {children}
          </div>
        </div></WorkspaceBrandingProvider>
      )}
    </>
  );
}
