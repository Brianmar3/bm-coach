import type { ReactNode } from "react";
import { PlatformShell } from "@/componentes/platform-shell";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";
import { masterPwaMetadata } from "@/lib/master-pwa";

export const metadata = masterPwaMetadata;

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  await requirePlatformOwnerPage();
  return <PlatformShell>{children}</PlatformShell>;
}
