import type { ReactNode } from "react";
import { PlatformShell } from "@/componentes/platform-shell";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  await requirePlatformOwnerPage();
  return <PlatformShell>{children}</PlatformShell>;
}
