import type { ReactNode } from "react";
import { requirePlatformOwnerPage } from "@/lib/platform-auth";

export default async function PlatformLayout({ children }: { children: ReactNode }) {
  await requirePlatformOwnerPage();
  return children;
}
