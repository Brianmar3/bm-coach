import Link from "next/link";
import { requireSelfServiceAccount } from "@/lib/self-service-account";
import { selfServicePreferences } from "@/lib/self-service";
import { profileDate, profileMeasurement } from "@/lib/self-service-presentation";
import { SelfServiceShell } from "@/componentes/self-service-shell";
import { SelfServiceAccountActions } from "@/componentes/self-service-account-actions";
export default async function SelfServiceInformationPage() {
  const { student } = await requireSelfServiceAccount();
  const prefs = selfServicePreferences(student);
  const weekdays = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
  const fields = [["Correo", student.email], ["Teléfono", student.phone], ["Fecha de nacimiento", profileDate(student.birthDate)], ["Altura", profileMeasurement(student.height, "cm")], ["Peso", profileMeasurement(student.weight, "kg")], ["Objetivo", student.goal], ["Nivel", student.experienceLevel], ["Experiencia", student.trainingExperience], ["Días", prefs.availableDays.map((day) => weekdays[day - 1]).join(", ")], ["Duración", `${prefs.sessionMinutes} minutos`], ["Lugar", prefs.trainingLocation], ["Equipamiento", prefs.equipment.join(", ")], ["Molestias o limitaciones", student.hasLimitations ? student.limitations : "Sin limitaciones declaradas"]];
  return <SelfServiceShell student={student}><Link href="/portal/autogestion/perfil" className="inline-flex min-h-11 items-center text-sm text-yellow-400">← Perfil</Link><h1 className="text-3xl font-bold">Mi perfil</h1><section className="mt-5 rounded-3xl border border-yellow-400/25 bg-zinc-900 p-5"><dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">{fields.map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border border-zinc-800 p-3"><dt className="text-zinc-400">{label}</dt><dd className="mt-1 break-words">{value || "—"}</dd></div>)}</dl><Link href="/portal/autogestion/perfil/editar" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-yellow-400 px-4 font-bold text-black">Editar mi perfil</Link><SelfServiceAccountActions /></section></SelfServiceShell>;
}
