import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSelfServiceAccount } from "@/lib/self-service-account";
import { selfServicePreferences } from "@/lib/self-service";
import { getWorkoutWeekRange } from "@/lib/workout-week";
import { SelfServiceShell } from "@/componentes/self-service-shell";
import { BmTargetIcon, BmRoutineIcon, BmProgressIcon } from "@/componentes/icons";

export default async function SelfServiceHomePage() {
  const { student, studentId } = await requireSelfServiceAccount();
  const prefs = selfServicePreferences(student);
  const week = getWorkoutWeekRange();
  const [weeklySessions, totalSessions] = await Promise.all([
    prisma.workoutSession.count({ where: { studentId, status: "COMPLETED", date: { gte: week.startDate, lt: week.endExclusiveDate } } }),
    prisma.workoutSession.count({ where: { studentId, status: "COMPLETED" } }),
  ]);
  return <SelfServiceShell><div className="space-y-4">
    <section className="portal-home-hero relative overflow-hidden rounded-[28px] border border-yellow-400/25 bg-gradient-to-br from-zinc-900 via-[#111108] to-black px-5 py-6 sm:p-8"><h1 className="relative z-10 break-words text-3xl font-bold tracking-tight sm:text-4xl">Hola, <span className="text-yellow-400">{student.firstName}</span></h1><p className="mt-2 text-sm text-zinc-300 sm:text-base">Tu entrenamiento empieza acá.</p></section>
    <section className="rounded-3xl border border-yellow-400/20 bg-zinc-900 p-5"><h2 className="flex items-center gap-2 text-xs font-bold tracking-[.16em] text-yellow-400"><BmTargetIcon size={22} />TU OBJETIVO</h2><p className="mt-3 break-words text-xl font-semibold">{student.goal || "Sin objetivo definido"}</p><p className="mt-1 text-sm text-zinc-400">{student.experienceLevel || "Sin nivel definido"} · {prefs.availableDays.length} {prefs.availableDays.length === 1 ? "día" : "días"}</p></section>
    <section className="rounded-3xl border border-yellow-400/25 bg-gradient-to-br from-zinc-900 to-black p-5"><h2 className="flex items-center gap-2 text-xs font-bold tracking-[.16em] text-yellow-400"><BmRoutineIcon size={22} />TU RUTINA</h2><p className="mt-3 text-lg font-semibold">Todavía no creaste una rutina.</p><Link href="/portal/autogestion/rutina" className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-yellow-400 px-4 font-bold text-black">Crear mi rutina <span aria-hidden="true">→</span></Link></section>
    <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5"><h2 className="flex items-center gap-2 text-xs font-bold tracking-[.16em] text-yellow-400"><BmProgressIcon size={22} />TU PROGRESO</h2><p className="mt-3 text-lg"><strong className="text-2xl">{weeklySessions}</strong> {weeklySessions === 1 ? "entrenamiento esta semana" : "entrenamientos esta semana"}</p><p className="mt-2 text-sm text-zinc-400">{totalSessions} {totalSessions === 1 ? "sesión completada en total" : "sesiones completadas en total"}</p></section>
  </div></SelfServiceShell>;
}
