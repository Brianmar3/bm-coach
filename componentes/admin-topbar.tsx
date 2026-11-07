"use client";

import Link from "next/link";

import { AdminNotificationCenter } from "@/componentes/admin-notification-center";
import { AppBrandIdentity } from "@/componentes/app-brand-identity";
import { useWorkspaceBranding } from "@/componentes/workspace-branding-provider";

export function AdminTopbar() {
  const branding = useWorkspaceBranding();

  return (
    <header className="admin-topbar fixed inset-x-0 top-0 z-40 h-[calc(env(safe-area-inset-top)+4.5rem)] border-b border-yellow-400/10 bg-[var(--nav-bg)] pt-[env(safe-area-inset-top)] shadow-[0_12px_40px_rgba(0,0,0,.12)] backdrop-blur-xl">
      <div className="flex h-[4.5rem] min-w-0 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2 pl-12 sm:gap-3 lg:pl-0"
          aria-label={`Ir al Dashboard de ${branding.displayName}`}
        >
          <AppBrandIdentity branding={branding} />
        </Link>

        <div className="flex shrink-0 items-center">
          <AdminNotificationCenter />
        </div>
      </div>
    </header>
  );
}
