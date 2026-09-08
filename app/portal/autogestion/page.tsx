import Link from "next/link";
import { PortalHeroFrame, PortalRoutineFrame, PORTAL_STAT_CARD_CLASS } from "@/componentes/portal-visuals";
import { prisma } from "@/lib/prisma";
import { requireSelfServiceAccount } from "@/lib/self-service-account";
import { selfServicePreferences } from "@/lib/self-service";
import { getWorkoutWeekRange } from "@/lib/workout-week";
import { SelfServiceShell } from "@/componentes/self-service-shell";
import { BmTargetIcon, BmRoutineIcon, BmProgressIcon } from "@/componentes/icons";
import { activePortalRoutineWhere } from "@/lib/portal-service-access";

export default async function SelfServiceHomePage() {
  const { student, studentId } = await requireSelfServiceAccount();
  const prefs = selfServicePreferences(student);
  const week = getWorkoutWeekRange();
  const [weeklySessions, totalSessions, activeRoutine] = await Promise.all([
    prisma.workoutSession.count({ where: { studentId, status: "COMPLETED", date: { gte: week.startDate, lt: week.endExclusiveDate } } }),
    prisma.workoutSession.count({ where: { studentId, status: "COMPLETED" } }),
    prisma.trainingRoutine.findFirst({ where: activePortalRoutineWhere(studentId), select: { id: true, name: true, days: { where: { active: true, archivedAt: null }, select: { id: true, dayNumber: true, name: true }, orderBy: { dayNumber: "asc" } }, workoutSessions: { where: { studentId, status: "COMPLETED" }, select: { dayId: true }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 1 } }, orderBy: { updatedAt: "desc" } }),
  ]);
  const lastDayId = activeRoutine?.workoutSessions[0]?.dayId;
  const lastDayIndex = activeRoutine?.days.findIndex((day) => day.id === lastDayId) ?? -1;
  const nextDay = activeRoutine?.days.length ? activeRoutine.days[(lastDayIndex + 1) % activeRoutine.days.length] : null;
  return <SelfServiceShell student={student}><div className="portal-home-sequence mx-auto max-w-5xl space-y-4">
    <PortalHeroFrame><span aria-hidden="true" className="portal-home-light-sweep" /><div className="relative"><h1 className="break-words text-[clamp(1.85rem,8vw,3.15rem)] font-black leading-none tracking-[-.045em] text-zinc-50">Hola, <span className="text-yellow-400">{student.firstName}</span></h1><p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500 sm:mt-2.5 sm:text-base">Tu entrenamiento empieza acá.</p></div></PortalHeroFrame>
    <PortalRoutineFrame><div className="flex items-center gap-3"><BmTargetIcon size={22} className="shrink-0 text-yellow-400" /><div className="min-w-0"><h2 className="text-[9px] font-black uppercase tracking-[.2em] text-yellow-400">Tu objetivo</h2><p className="mt-1 break-words text-base font-black leading-tight text-zinc-50 min-[390px]:text-lg">{student.goal || "Sin objetivo definido"}</p><p className="mt-1 text-xs text-zinc-500">{student.experienceLevel || "Sin nivel definido"} · {prefs.availableDays.length} {prefs.availableDays.length === 1 ? "día" : "días"}</p></div></div></PortalRoutineFrame>
    <PortalRoutineFrame><p className="text-[9px] font-black uppercase tracking-[.2em] text-yellow-400">Tu rutina</p><div className="mt-2.5 flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full border border-yellow-400/25 bg-yellow-400/[.05] text-yellow-300"><BmRoutineIcon size={22} /></span><div className="min-w-0"><h2 className="text-base font-black leading-tight text-zinc-50 min-[390px]:text-lg">{activeRoutine?.name ?? "Todavía no creaste una rutina."}</h2>{activeRoutine && <p className="mt-1 text-xs text-zinc-500">{activeRoutine.days.length} {activeRoutine.days.length === 1 ? "día" : "días"}{nextDay ? ` · Próximo: Día ${nextDay.dayNumber}${nextDay.name ? ` · ${nextDay.name}` : ""}` : ""}</p>}</div></div><Link href="/portal/autogestion/rutina" className="portal-home-interactive mt-2.5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-yellow-400/45 px-4 text-sm font-bold text-yellow-300 transition hover:bg-yellow-400/[.06]">{activeRoutine ? "Entrenar ahora" : "Crear mi rutina"} <span aria-hidden="true">→</span></Link></PortalRoutineFrame>
    <section aria-label="Tu progreso" className="portal-home-enter grid grid-cols-2 gap-2 sm:gap-3">{[{ label: "Esta semana", value: weeklySessions, detail: "entrenamientos esta semana" }, { label: "Sesiones totales", value: totalSessions, detail: "sesiones completadas en total" }].map(({ label, value, detail }) => <div key={label} className={PORTAL_STAT_CARD_CLASS}><BmProgressIcon size={17} className="absolute right-3.5 top-3.5 text-yellow-400/60 min-[390px]:right-4 min-[390px]:top-4" /><h2 className="pr-6 text-[8px] font-black uppercase tracking-[.15em] text-yellow-400 min-[390px]:text-[10px]">{label}</h2><p className="mt-3 text-xl font-semibold leading-none text-zinc-100 sm:text-2xl">{value}</p><p className="mt-2 text-[9px] leading-snug text-zinc-500 sm:text-[11px]">{detail}</p></div>)}</section>
  </div></SelfServiceShell>;
}
