import type { ReactNode } from "react";
import { PushDiagnostics } from "@/componentes/push-diagnostics";

export default function ConfigurationLayout({ children }: { children: ReactNode }) {
  return <>{children}<div className="bg-zinc-950 px-6 pb-10 text-white md:px-10"><div className="mx-auto max-w-7xl"><PushDiagnostics /></div></div></>;
}
