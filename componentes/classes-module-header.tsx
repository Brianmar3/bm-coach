"use client";

import { Suspense } from "react";
import { ClassesSecondaryNav } from "@/componentes/classes-secondary-nav";

export function ClassesModuleHeader() {
  return (
    <>
      <div className="bg-zinc-950 px-6 pt-6 text-white md:px-10 md:pt-10">
        <header className="mx-auto mb-8 max-w-7xl">
          <p className="text-sm font-bold uppercase tracking-[.2em] text-yellow-400">GESTIÓN BM TRAINING</p>
          <h1 className="mt-2 text-3xl font-bold">Clases</h1>
          <p className="mt-1 text-zinc-400">Organizá tus horarios fijos de lunes a viernes y asigná alumnos a cada grupo.</p>
        </header>
      </div>
      <div className="sticky top-0 z-30 border-y border-zinc-800 bg-zinc-950/95 px-4 shadow-lg shadow-black/30 backdrop-blur md:px-8">
        <div className="mx-auto max-w-7xl lg:rounded-2xl lg:border-x lg:border-zinc-800">
          <Suspense fallback={<div className="h-[58px]" aria-hidden="true" />}>
            <ClassesSecondaryNav />
          </Suspense>
        </div>
      </div>
    </>
  );
}
