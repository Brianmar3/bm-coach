import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Política de Privacidad | BM Training",
  description: "Política de Privacidad de BM Training.",
};

const sectionClass = "scroll-mt-24 border-t border-yellow-400/15 pt-8 sm:pt-10";
const headingClass = "text-xl font-black tracking-tight text-white sm:text-2xl";
const paragraphClass = "mt-4 text-[0.98rem] leading-7 text-zinc-300 sm:text-base sm:leading-8";
const listClass = "mt-4 list-disc space-y-2 pl-6 text-[0.98rem] leading-7 text-zinc-300 marker:text-yellow-400 sm:text-base sm:leading-8";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen overflow-x-hidden bg-black text-white">
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 h-[32rem] bg-[radial-gradient(circle_at_50%_-20%,rgba(250,204,21,0.18),transparent_58%)]" />

      <header className="relative border-b border-yellow-400/15 bg-black/90">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <Link href="/" aria-label="Ir al inicio de BM Training" className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
            <Image
              src="/bm-training-logo(2).png"
              alt="Logo de BM Training"
              width={1254}
              height={1254}
              preload
              unoptimized
              className="size-12 shrink-0 rounded-xl object-contain sm:size-14"
            />
            <div className="min-w-0">
              <p className="truncate text-lg font-black tracking-wide sm:text-xl">BM Training</p>
              <p className="hidden text-xs text-zinc-400 sm:block">Gestión, entrenamiento y seguimiento</p>
            </div>
          </Link>
          <Link href="/" className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-xl border border-yellow-400/35 px-4 text-sm font-bold text-yellow-300 transition hover:border-yellow-300 hover:bg-yellow-400/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
            Volver al inicio
          </Link>
        </div>
      </header>

      <article className="relative mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-16">
        <div className="overflow-hidden rounded-3xl border border-yellow-400/20 bg-gradient-to-br from-zinc-900 via-zinc-950 to-black p-6 shadow-2xl shadow-yellow-950/20 sm:p-10 lg:p-12">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-yellow-400">BM Training</p>
            <h1 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-5xl">Política de Privacidad de BM Training</h1>
            <p className="mt-5 text-sm font-semibold text-yellow-200">Última actualización: 30 de septiembre de 2026</p>
            <p className={paragraphClass}>BM Training es una plataforma de gestión, entrenamiento y seguimiento destinada a entrenadores, gimnasios y alumnos.</p>
            <p className={paragraphClass}>Esta Política de Privacidad explica qué información puede recopilarse, cómo se utiliza, cómo se protege y qué opciones tienen los usuarios respecto de sus datos.</p>
          </div>

          <div className="mt-10 space-y-10 sm:mt-12 sm:space-y-12">
            <section className={sectionClass}>
              <h2 className={headingClass}>1. Información que puede recopilar BM Training</h2>
              <p className={paragraphClass}>Según el tipo de cuenta y las funciones utilizadas, BM Training puede tratar información como:</p>
              <ul className={listClass}>
                <li>nombre y apellido</li>
                <li>correo electrónico</li>
                <li>nombre de usuario</li>
                <li>datos de cuenta y acceso</li>
                <li>datos del entrenador, gimnasio, marca o servicio</li>
                <li>información relacionada con alumnos</li>
                <li>rutinas, ejercicios, clases y planificación de entrenamiento</li>
                <li>asistencia y reservas</li>
                <li>evaluaciones y seguimiento del progreso</li>
                <li>registros de peso, repeticiones, series, RIR y otros datos de entrenamiento</li>
                <li>objetivos y adherencia</li>
                <li>información relacionada con pagos, estado del servicio y fechas de vencimiento</li>
                <li>fotografías cargadas dentro de funciones habilitadas de la plataforma</li>
                <li>preferencias de personalización</li>
                <li>identificadores técnicos necesarios para notificaciones</li>
                <li>información básica del dispositivo necesaria para el funcionamiento de la aplicación</li>
              </ul>
              <p className={paragraphClass}>BM Training no solicita contraseñas bancarias ni datos completos de tarjetas de crédito dentro de sus funciones actuales.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>2. Uso de la información</h2>
              <p className={paragraphClass}>La información se utiliza para permitir el funcionamiento de BM Training y brindar funciones como:</p>
              <ul className={listClass}>
                <li>gestión de alumnos</li>
                <li>administración de clases y servicios</li>
                <li>creación y seguimiento de rutinas</li>
                <li>registro de entrenamientos</li>
                <li>seguimiento de asistencia</li>
                <li>evaluaciones y progreso</li>
                <li>control del estado del servicio</li>
                <li>recordatorios de vencimiento</li>
                <li>notificaciones relacionadas con clases, entrenamientos y actividad de la cuenta</li>
                <li>personalización de la experiencia del entrenador</li>
                <li>seguridad y mantenimiento de la plataforma</li>
                <li>detección y corrección de errores</li>
              </ul>
              <p className={paragraphClass}>La información no se utiliza para vender datos personales a terceros.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>3. Entrenadores y alumnos</h2>
              <p className={paragraphClass}>BM Training permite que entrenadores administren información relacionada con sus propios alumnos.</p>
              <p className={paragraphClass}>Cada entrenador trabaja dentro de un espacio de trabajo independiente.</p>
              <p className={paragraphClass}>Los datos de un workspace no deben utilizarse para brindar información a otros entrenadores o espacios de trabajo ajenos.</p>
              <p className={paragraphClass}>Los entrenadores son responsables de utilizar la información de sus alumnos de manera adecuada dentro de los servicios que ofrecen.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>4. Notificaciones</h2>
              <p className={paragraphClass}>BM Training puede utilizar notificaciones para informar sobre:</p>
              <ul className={listClass}>
                <li>clases</li>
                <li>asistencia</li>
                <li>entrenamientos</li>
                <li>temporizadores</li>
                <li>actividad relevante de la cuenta</li>
                <li>vencimientos de servicios</li>
                <li>otras funciones relacionadas directamente con el uso de la plataforma</li>
              </ul>
              <p className={paragraphClass}>En dispositivos compatibles, el usuario puede aceptar o rechazar las notificaciones desde el sistema operativo y modificar estos permisos posteriormente desde la configuración del dispositivo.</p>
              <p className={paragraphClass}>BM Training utiliza servicios de notificaciones de Firebase para determinadas funciones de mensajería.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>5. Fotografías y archivos</h2>
              <p className={paragraphClass}>Algunas funciones de BM Training pueden permitir que entrenadores o alumnos carguen imágenes o archivos relacionados con el seguimiento de su servicio.</p>
              <p className={paragraphClass}>Estos archivos se utilizan únicamente para prestar las funciones correspondientes dentro de la plataforma y están asociados al usuario o espacio de trabajo correspondiente.</p>
              <p className={paragraphClass}>BM Training no utiliza estas fotografías para publicidad de terceros.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>6. Datos de entrenamiento y progreso</h2>
              <p className={paragraphClass}>BM Training puede almacenar información sobre entrenamientos, rutinas, evaluaciones y progreso.</p>
              <p className={paragraphClass}>Estos datos tienen como finalidad permitir que entrenadores y alumnos hagan seguimiento de la actividad realizada y de la evolución dentro del servicio.</p>
              <p className={paragraphClass}>BM Training no sustituye asesoramiento médico ni realiza diagnósticos clínicos.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>7. Pagos y vencimientos</h2>
              <p className={paragraphClass}>BM Training puede almacenar información administrativa relacionada con:</p>
              <ul className={listClass}>
                <li>estado de pagos</li>
                <li>servicios contratados</li>
                <li>períodos</li>
                <li>fechas de vencimiento</li>
                <li>historial relacionado con el servicio</li>
              </ul>
              <p className={paragraphClass}>Estos datos se utilizan con fines de gestión y recordatorio.</p>
              <p className={paragraphClass}>BM Training no almacena actualmente datos completos de tarjetas bancarias dentro de la aplicación.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>8. Servicios de terceros</h2>
              <p className={paragraphClass}>BM Training puede utilizar proveedores tecnológicos necesarios para operar la plataforma, incluyendo servicios de:</p>
              <ul className={listClass}>
                <li>alojamiento</li>
                <li>infraestructura</li>
                <li>almacenamiento</li>
                <li>base de datos</li>
                <li>autenticación</li>
                <li>notificaciones</li>
                <li>distribución de la aplicación</li>
                <li>análisis técnico y estabilidad</li>
              </ul>
              <p className={paragraphClass}>Entre ellos pueden encontrarse servicios como Google Firebase, Google Play y proveedores de infraestructura web utilizados por BM Training.</p>
              <p className={paragraphClass}>Estos servicios pueden procesar datos técnicos necesarios para prestar sus funciones.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>9. Seguridad</h2>
              <p className={paragraphClass}>BM Training utiliza medidas técnicas y organizativas razonables para proteger la información.</p>
              <p className={paragraphClass}>Entre otras medidas, se busca:</p>
              <ul className={listClass}>
                <li>separar datos por usuario y workspace</li>
                <li>limitar accesos según permisos</li>
                <li>proteger credenciales</li>
                <li>evitar exposición innecesaria de información</li>
                <li>utilizar conexiones seguras</li>
                <li>restringir el acceso a archivos privados</li>
                <li>mantener controles de autenticación</li>
              </ul>
              <p className={paragraphClass}>Ningún sistema informático puede garantizar seguridad absoluta, pero BM Training trabaja para reducir riesgos y corregir vulnerabilidades cuando son detectadas.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>10. Conservación de datos</h2>
              <p className={paragraphClass}>Los datos se conservan mientras sean necesarios para prestar el servicio, mantener la cuenta o cumplir funciones administrativas y operativas.</p>
              <p className={paragraphClass}>Cuando una cuenta o relación de servicio finaliza, cierta información puede conservarse durante un período razonable cuando sea necesaria para seguridad, respaldo, funcionamiento o resolución de incidencias.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>11. Eliminación y modificación de datos</h2>
              <p className={paragraphClass}>Los usuarios pueden solicitar la modificación o eliminación de determinada información personal vinculada a su cuenta.</p>
              <p className={paragraphClass}>Dependiendo del tipo de usuario, algunas modificaciones pueden gestionarse desde BM Training o mediante contacto con el entrenador responsable del servicio.</p>
              <p className={paragraphClass}>También puede solicitarse asistencia para la eliminación de una cuenta o datos asociados mediante los canales de contacto indicados en esta política.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>12. Menores de edad</h2>
              <p className={paragraphClass}>BM Training puede ser utilizada dentro de servicios de entrenamiento que incluyan menores únicamente bajo la responsabilidad del entrenador, gimnasio y, cuando corresponda, de sus padres, tutores o responsables legales.</p>
              <p className={paragraphClass}>BM Training no está diseñada para que menores creen y administren por cuenta propia servicios profesionales dentro de la plataforma.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>13. Cambios en esta Política</h2>
              <p className={paragraphClass}>Esta Política de Privacidad puede actualizarse cuando BM Training incorpore nuevas funciones, proveedores, cambios técnicos o requisitos aplicables.</p>
              <p className={paragraphClass}>La versión actualizada se publicará en esta misma página indicando la fecha de modificación.</p>
            </section>

            <section className={sectionClass}>
              <h2 className={headingClass}>14. Contacto</h2>
              <div className="mt-5 rounded-2xl border border-yellow-400/20 bg-yellow-400/[0.05] p-5 text-zinc-300 sm:p-6">
                <p className="font-black text-white">BM Training</p>
                <p className="mt-4 text-sm font-semibold text-zinc-400">Responsable:</p>
                <p className="mt-1">Brian Martínez</p>
                <p className="mt-4 text-sm font-semibold text-zinc-400">Correo electrónico:</p>
                <a href="mailto:briiianm36@gmail.com" className="mt-1 inline-block break-all font-semibold text-yellow-300 underline decoration-yellow-400/40 underline-offset-4 hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400">
                  briiianm36@gmail.com
                </a>
              </div>
            </section>
          </div>
        </div>
      </article>
    </main>
  );
}
