"use client";

import { Suspense } from "react";
import { ClassesSecondaryNav } from "@/componentes/classes-secondary-nav";

export function ClassesModuleHeader() {
  return (
    <>
      <div className="admin-page px-4 pt-6 text-white sm:px-6 md:px-8 md:pt-9 xl:px-10">
        <header className="admin-page-header mx-auto mb-7 max-w-7xl">
          <p className="text-[11px] font-bold uppercase tracking-[.24em] text-yellow-400">Gestión BM Training</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Clases</h1>
          <p className="mt-1 max-w-2xl text-sm text-zinc-400">Organizá tus horarios fijos, grupos y asistencias desde un mismo lugar.</p>
        </header>
      </div>
      <div className="sticky top-[calc(env(safe-area-inset-top)+4.5rem)] z-30 border-y border-yellow-400/10 bg-black/90 px-4 shadow-lg shadow-black/30 backdrop-blur-xl md:px-8 xl:px-10">
        <div className="mx-auto max-w-7xl">
          <Suspense fallback={<div className="h-[58px]" aria-hidden="true" />}>
            <ClassesSecondaryNav />
          </Suspense>
        </div>
      </div>
    </>
  );
}
