import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-auth";
import { isSelfService, selfServicePreferences } from "@/lib/self-service";
import { onboardingIsComplete } from "@/lib/student-onboarding";
import { BmCheckIcon, BmProfileIcon } from "@/componentes/icons";
import { SelfServiceAccountActions } from "@/componentes/self-service-account-actions";
import type { Student } from "@/types/gestion";

export default async function SelfServiceAccountPage() {
  const session = await getPortalSession({ allowSelfService: true });
  if (!session) redirect("/portal/login");
  const student = session.credential.student.data as unknown as Student;
  if (!isSelfService(student)) redirect("/portal");
  if (!onboardingIsComplete(student)) redirect("/portal/onboarding");
  const prefs = selfServicePreferences(student);
  const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  return <main className="min-h-[100dvh] bg-black p-4 text-white sm:p-8"><div className="mx-auto max-w-2xl"><header className="mb-6 flex items-center gap-3"><Image src="/bm-training-mark.png" width={52} height={52} alt="BM Training" /><span className="font-bold">BM <strong className="text-yellow-400">TRAINING</strong></span></header>
    <section className="rounded-3xl border border-yellow-400/25 bg-zinc-900 p-5 sm:p-7"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-yellow-400"><BmProfileIcon size={20} />Usuario autogestionado</p><h1 className="mt-3 text-2xl font-bold">Hola, {student.firstName}</h1><p className="mt-3 flex items-center gap-2 text-emerald-300"><BmCheckIcon size={20} />Tu perfil quedó guardado.</p><p className="mt-3 text-sm text-zinc-300">Tu cuenta es independiente, sin entrenador asignado. El creador de rutinas todavía no está disponible.</p>
    <dl className="mt-6 grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">{[["Correo", student.email], ["Teléfono", student.phone], ["Fecha de nacimiento", student.birthDate], ["Altura", `${student.height} cm`], ["Peso", `${student.weight} kg`], ["Objetivo", student.goal], ["Nivel", student.experienceLevel], ["Experiencia", student.trainingExperience], ["Días", prefs.availableDays.map((day) => weekdays[day - 1]).join(", ")], ["Duración", `${prefs.sessionMinutes} minutos`], ["Lugar", prefs.trainingLocation], ["Equipamiento", prefs.equipment.join(", ")], ["Molestias o limitaciones", student.hasLimitations ? student.limitations : "Sin limitaciones declaradas"]].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-zinc-800 p-3"><dt className="text-zinc-400">{label}</dt><dd className="mt-1 break-words">{value}</dd></div>)}</dl>
    <Link href="/portal/autogestion/perfil" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-yellow-400 px-4 font-bold text-black">Editar mi perfil</Link><SelfServiceAccountActions /></section>
  </div></main>;
}
