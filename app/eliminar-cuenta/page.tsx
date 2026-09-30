import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Eliminar cuenta | BM Training",
  description: "Cómo solicitar la eliminación de una cuenta de BM Training y de sus datos asociados.",
};

const sectionClass = "border-t border-yellow-400/15 pt-7 sm:pt-9";
const headingClass = "text-xl font-black text-white sm:text-2xl";
const paragraphClass = "mt-3 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8";
const listClass = "mt-4 list-disc space-y-2 pl-6 text-sm leading-7 text-zinc-300 marker:text-yellow-400 sm:text-base sm:leading-8";

export default function DeleteAccountPage() {
  return <main className="min-h-screen overflow-x-hidden bg-black text-white">
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 h-[30rem] bg-[radial-gradient(circle_at_50%_-20%,rgba(250,204,21,0.16),transparent_58%)]" />
    <header className="relative border-b border-yellow-400/15 bg-black/90">
      <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
        <Link href="/" aria-label="Ir al inicio de BM Training" className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
          <Image src="/bm-training-logo(2).png" alt="Logo de BM Training" width={1254} height={1254} preload unoptimized className="size-12 shrink-0 rounded-xl object-contain sm:size-14" />
          <div className="min-w-0"><p className="truncate text-lg font-black tracking-wide sm:text-xl">BM Training</p><p className="hidden text-xs text-zinc-400 sm:block">Gestión, entrenamiento y seguimiento</p></div>
        </Link>
        <Link href="/" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-yellow-400/35 px-4 text-sm font-bold text-yellow-300 hover:bg-yellow-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">Volver al inicio</Link>
      </div>
    </header>

    <article className="relative mx-auto w-full max-w-4xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
      <div className="rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-2xl shadow-yellow-950/20 sm:p-10 lg:p-12">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-400">BM Training</p>
        <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">Eliminación de cuenta</h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-300">Podés solicitar la eliminación de tu cuenta de BM Training y de los datos asociados mediante un flujo autenticado dentro de la aplicación.</p>

        <div className="mt-10 space-y-9 sm:mt-12 sm:space-y-11">
          <section className={sectionClass}>
            <h2 className={headingClass}>Cómo solicitar la eliminación</h2>
            <ol className="mt-4 list-decimal space-y-3 pl-6 text-sm leading-7 text-zinc-300 marker:font-bold marker:text-yellow-400 sm:text-base sm:leading-8">
              <li>Ingresá al Portal del Alumno con tu cuenta.</li>
              <li>Abrí <strong className="text-white">Perfil</strong>, luego <strong className="text-white">Configuración</strong> y entrá en <strong className="text-white">Privacidad</strong>.</li>
              <li>Elegí <strong className="text-white">Solicitar eliminación de cuenta</strong>.</li>
              <li>Leé la advertencia y confirmá la solicitud. La cuenta no se elimina instantáneamente sin esta confirmación.</li>
            </ol>
            <Link href="/portal/login" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-xl bg-yellow-400 px-5 font-black text-black transition hover:bg-yellow-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-200">Ingresar para solicitar la eliminación</Link>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Qué datos se eliminan</h2>
            <p className={paragraphClass}>Al aprobarse y completarse la solicitud, se eliminan o desvinculan de la cuenta los datos personales y contenidos asociados que BM Training ya no necesite conservar, incluyendo:</p>
            <ul className={listClass}>
              <li>credenciales y acceso al Portal del Alumno</li>
              <li>datos del perfil y preferencias</li>
              <li>rutinas, registros de entrenamiento y progreso</li>
              <li>asistencias, reservas y evaluaciones</li>
              <li>comentarios, notificaciones, fotografías y archivos asociados</li>
            </ul>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Conservación temporal</h2>
            <p className={paragraphClass}>Cierta información puede conservarse temporalmente cuando sea necesaria para cumplir obligaciones legales, proteger la seguridad de la plataforma, prevenir abusos, resolver incidencias o mantener respaldos. Esa información se limita a lo necesario y se elimina o anonimiza cuando deja de ser requerida.</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Si no podés acceder a tu cuenta</h2>
            <p className={paragraphClass}>Podés contactar a soporte desde el correo asociado a tu cuenta. Para proteger tus datos, BM Training puede solicitar información adicional para verificar tu identidad antes de procesar la eliminación.</p>
            <a href="mailto:briiianm36@gmail.com?subject=Solicitud%20de%20eliminaci%C3%B3n%20de%20cuenta%20BM%20Training" className="mt-5 inline-flex min-h-11 items-center rounded-xl border border-yellow-400/40 px-4 font-bold text-yellow-300 hover:bg-yellow-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">Contactar soporte</a>
            <p className="mt-3 break-all text-sm text-zinc-500">briiianm36@gmail.com</p>
          </section>

          <section className={sectionClass}>
            <h2 className={headingClass}>Más información</h2>
            <p className={paragraphClass}>Consultá la Política de Privacidad de BM Training para conocer cómo se trata y protege la información.</p>
            <Link href="/privacidad" className="mt-4 inline-flex min-h-11 items-center font-bold text-yellow-300 underline decoration-yellow-400/40 underline-offset-4">Ver Política de Privacidad</Link>
          </section>
        </div>
      </div>
    </article>
  </main>;
}
