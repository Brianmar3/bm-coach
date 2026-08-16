import Link from "next/link";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-black p-5 text-white">
    <section className="w-full max-w-lg rounded-3xl border border-yellow-400/20 bg-zinc-900 p-6 text-center shadow-2xl shadow-black">
      <p className="text-xs font-bold uppercase tracking-[.22em] text-yellow-400">BM Training</p>
      <h1 className="mt-3 text-2xl font-black">Esta pantalla no está disponible</h1>
      <p className="mt-2 text-sm text-zinc-400">El acceso puede haber cambiado o el contenido ya no existir.</p>
      <Link href="/" className="mt-6 grid min-h-11 place-items-center rounded-xl bg-yellow-400 px-4 font-bold text-zinc-950">Volver al inicio</Link>
    </section>
  </main>;
}
