"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Error de interfaz", { name: error.name, digest: error.digest ?? null });
  }, [error]);

  return <main className="grid min-h-[70dvh] place-items-center bg-black p-5 text-white">
    <section className="w-full max-w-lg rounded-3xl border border-yellow-400/20 bg-zinc-900 p-6 text-center shadow-2xl shadow-black">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-yellow-400">BM Training</p>
      <h1 className="mt-3 text-2xl font-black">No pudimos mostrar esta pantalla</h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">Tus datos no se modificaron. Podés volver a intentar o regresar al inicio.</p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={reset} className="min-h-11 rounded-xl bg-yellow-400 px-4 font-bold text-zinc-950">Reintentar</button>
        <Link href="/" className="grid min-h-11 place-items-center rounded-xl border border-zinc-700 px-4 font-bold text-zinc-200">Ir al inicio</Link>
      </div>
    </section>
  </main>;
}
