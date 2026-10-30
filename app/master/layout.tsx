import type { ReactNode } from "react";
import { masterPwaMetadata } from "@/lib/master-pwa";

export const metadata = masterPwaMetadata;

export default function MasterLayout({ children }: { children: ReactNode }) {
  return children;
}
