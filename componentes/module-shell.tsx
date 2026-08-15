import type { ReactNode } from "react";

export function ModuleShell({
  title,
  subtitle,
  action,
  hideHeader = false,
  flushTop = false,
  children,
}: {
  title: string;
  subtitle: string;
  action?: ReactNode;
  hideHeader?: boolean;
  flushTop?: boolean;
  children: ReactNode;
}) {
  return (
    <main className={`admin-page min-h-screen px-4 pb-8 text-white sm:px-6 md:px-8 md:pb-12 xl:px-10 ${flushTop ? "pt-5 md:pt-7" : "pt-6 md:pt-9"}`}>
      <div className="mx-auto min-w-0 max-w-7xl">
        {!hideHeader && (
          <header className="admin-page-header mb-7 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[.24em] text-yellow-400">Gestión BM Training</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
              <p className="mt-1 max-w-2xl text-sm text-zinc-400">{subtitle}</p>
            </div>
            {action && <div className="admin-module-action flex shrink-0 items-center">{action}</div>}
          </header>
        )}
        {children}
      </div>
    </main>
  );
}

export const inputClass =
  "w-full min-h-11 rounded-xl border border-zinc-700/80 bg-black/45 px-3 py-2 text-base text-white shadow-inner shadow-black/20 outline-none transition placeholder:text-zinc-500 focus:border-yellow-400/70 focus:ring-2 focus:ring-yellow-400/10 sm:text-sm";
