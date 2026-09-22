import { TrainerPasswordResetForm } from "@/componentes/trainer-password-reset-form";

export default async function TrainerPasswordResetPage({ params }: PageProps<"/trainer/reset-password/[token]">) {
  const { token } = await params;
  return <main className="grid min-h-screen place-items-center bg-black px-4 py-10 text-white"><section className="w-full max-w-md rounded-3xl border border-yellow-400/20 bg-zinc-900 p-6"><p className="text-xs font-black uppercase tracking-[.2em] text-yellow-400">BM Training</p><h1 className="mt-2 text-2xl font-black">Restablecer contraseña</h1><p className="mb-6 mt-2 text-sm text-zinc-400">Elegí una contraseña segura para tu cuenta de entrenador.</p><TrainerPasswordResetForm token={token} /></section></main>;
}
