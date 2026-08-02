"use client";

import { useMemo, useState, type ReactNode } from "react";
import { routineSeriesMetrics } from "@/lib/routine-metrics";
import type { TrainingExercise, TrainingRoutine, TrainingRoutineBlock } from "@/types/gestion";

type RoutineTableViewProps = {
  routine: TrainingRoutine;
  close: () => void;
  actions?: ReactNode;
};

const showDate = (value: string) =>
  value
    ? new Date(value).toLocaleDateString("es-AR")
    : "Sin definir";

const label = (value: string) =>
  value ? value[0].toUpperCase() + value.slice(1) : "Sin definir";

function exerciseSummary(exercise: TrainingExercise) {
  return [
    `${exercise.sets} series`,
    `${exercise.repetitions} reps`,
    exercise.weight === null ? null : `${exercise.weight} kg`,
    exercise.restSeconds === null ? null : `${exercise.restSeconds} s`,
  ].filter(Boolean).join(" · ");
}

function targetSummary(exercise: TrainingExercise) {
  if (exercise.targetType === "TIME" || exercise.targetType === "REST") return `${exercise.targetSeconds ?? 0} segundos`;
  if (exercise.targetType === "REPS") return `${exercise.targetRepetitions || exercise.repetitions} repeticiones`;
  if (exercise.targetType === "DISTANCE") return exercise.targetDistance || "Distancia libre";
  return exercise.targetSide || "Objetivo libre";
}

function ConditioningBlockContent({ block }: { block: TrainingRoutineBlock }) {
  const configuration = [block.rounds ? `${block.rounds} rondas` : null, block.durationSeconds ? `${Math.round(block.durationSeconds / 60)} min` : null, block.workSeconds ? `${block.workSeconds} s trabajo` : null, block.restSeconds !== null ? `${block.restSeconds} s pausa` : null].filter(Boolean).join(" · ");
  return <section className="border-b border-zinc-800 bg-zinc-900/55 px-4 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-wide text-yellow-300">{block.name}</p><p className="mt-1 text-xs text-zinc-500">{block.type.replace("_", " ")}{configuration ? ` · ${configuration}` : ""}</p></div><span className="rounded-lg bg-yellow-400/10 px-2 py-1 text-xs font-bold text-yellow-300">{block.exercises.length} ejercicios</span></div>{block.instructions && <p className="mt-3 whitespace-pre-wrap text-sm text-zinc-300">{block.instructions}</p>}<ol className="mt-3 space-y-2">{block.exercises.map((exercise) => <li key={exercise.id} className="rounded-lg bg-zinc-950 px-3 py-2 text-sm"><span className="font-semibold">{exercise.order}. {exercise.name}</span><span className="ml-2 text-xs text-zinc-500">{targetSummary(exercise)}{exercise.targetSide ? ` · ${exercise.targetSide}` : ""}</span></li>)}</ol></section>;
}

export function RoutineTableView({
  routine,
  close,
  actions,
}: RoutineTableViewProps) {
  const firstDay = routine.days[0]?.id ?? "";
  const [openDayId, setOpenDayId] = useState(firstDay);
  const metrics = useMemo(() => routineSeriesMetrics(routine), [routine]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-2 backdrop-blur-sm sm:p-5">
      <section className="mx-auto my-2 w-full max-w-6xl overflow-hidden rounded-3xl border border-yellow-400/15 bg-[#101010] text-white shadow-2xl sm:my-6">
        <header className="border-b border-zinc-800 bg-gradient-to-br from-zinc-900 to-[#0a0a0a] p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-yellow-400">
                Vista de rutina
              </p>
              <h2 className="mt-1 break-words text-2xl font-bold">
                {routine.name}
              </h2>
              <p className="mt-2 text-sm text-yellow-300">
                {routine.objective || "Sin objetivo definido"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-zinc-400">
                <span className="rounded-full border border-zinc-700 bg-black/40 px-2.5 py-1">
                  {label(routine.level)}
                </span>
                <span className="rounded-full border border-zinc-700 bg-black/40 px-2.5 py-1">
                  {label(routine.status)}
                </span>
                <span className="rounded-full border border-zinc-700 bg-black/40 px-2.5 py-1">
                  {routine.days.length} día{routine.days.length === 1 ? "" : "s"}
                </span>
                <span className="rounded-full border border-zinc-700 bg-black/40 px-2.5 py-1">
                  Actualizada {showDate(routine.updatedAt)}
                </span>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                {routine.students.length
                  ? `Asignada a ${routine.students.map((student) => student.name).join(" · ")}`
                  : "Sin alumnos asignados"}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:max-w-md lg:justify-end">
              {actions}
              <button
                type="button"
                onClick={close}
                className="min-h-10 rounded-xl border border-zinc-700 px-3 text-sm font-bold text-zinc-300 hover:border-yellow-400/30"
              >
                Volver
              </button>
            </div>
          </div>
        </header>

        <div className="space-y-4 p-3 sm:p-5">
          {routine.days.map((day) => {
            const open = openDayId === day.id;
            const strengthExercises = day.blocks.filter((block) => block.type === "STRENGTH").flatMap((block) => block.exercises);
            const conditioningBlocks = day.blocks.filter((block) => block.type !== "STRENGTH");
            return (
              <article
                key={day.id}
                className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/75"
              >
                <button
                  type="button"
                  onClick={() => setOpenDayId(open ? "" : day.id)}
                  aria-expanded={open}
                  className="flex min-h-14 w-full items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3 text-left md:cursor-default"
                >
                  <span className="min-w-0">
                    <strong className="block truncate text-sm uppercase tracking-wide text-yellow-300">
                      Día {day.dayNumber} — {day.name || "Entrenamiento"}
                    </strong>
                    <span className="mt-1 block truncate text-xs text-zinc-500">
                      {day.objective || `${day.exercises.length} ejercicios`}
                    </span>
                  </span>
                  <span className="text-lg text-yellow-400 md:hidden">
                    {open ? "−" : "+"}
                  </span>
                </button>

                <div className={`${open ? "block" : "hidden"} md:block`}>
                  {day.warmup.trim() && (
                    <section className="border-b border-zinc-800 bg-yellow-400/[.04] px-4 py-3">
                      <h3 className="text-xs font-black uppercase tracking-wide text-yellow-300">Entrada en calor</h3>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-zinc-300">{day.warmup}</p>
                    </section>
                  )}
                  {conditioningBlocks.map((block) => <ConditioningBlockContent key={block.id} block={block} />)}
                  {strengthExercises.length === 0 && conditioningBlocks.length === 0 ? (
                    <p className="p-5 text-sm text-zinc-500">
                      Descanso o sin ejercicios planificados.
                    </p>
                  ) : (
                    <>
                      <div className="divide-y divide-zinc-800 md:hidden">
                        {strengthExercises.map((exercise) => (
                          <div key={exercise.id} className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-yellow-400/10 text-xs font-black text-yellow-300">
                                {exercise.order}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-semibold text-zinc-100">
                                    {exercise.name}
                                  </p>
                                  {exercise.videoUrl && (
                                    <a
                                      href={exercise.videoUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="shrink-0 text-xs font-bold text-yellow-300"
                                    >
                                      Video
                                    </a>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-zinc-400">
                                  {exerciseSummary(exercise)}
                                </p>
                                <p className="mt-1 text-[11px] text-zinc-600">
                                  {exercise.observations || "Sin observaciones"}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="hidden overflow-x-auto md:block">
                        <table className="w-full min-w-[900px] table-fixed text-left text-sm">
                          <thead className="bg-black/45 text-[10px] uppercase tracking-wider text-zinc-500">
                            <tr>
                              <th className="w-12 px-3 py-3">#</th>
                              <th className="w-52 px-3 py-3">Ejercicio</th>
                              <th className="w-20 px-3 py-3">Series</th>
                              <th className="w-24 px-3 py-3">Reps</th>
                              <th className="w-24 px-3 py-3">Carga</th>
                              <th className="w-24 px-3 py-3">Descanso</th>
                              <th className="px-3 py-3">Observaciones</th>
                              <th className="w-20 px-3 py-3">Video</th>
                            </tr>
                          </thead>
                          <tbody>
                            {strengthExercises.map((exercise, index) => (
                              <tr
                                key={exercise.id}
                                className={`border-t border-zinc-800 ${
                                  index % 2 ? "bg-white/[.015]" : ""
                                }`}
                              >
                                <td className="px-3 py-3 font-bold text-yellow-400">
                                  {exercise.order}
                                </td>
                                <td className="px-3 py-3 font-semibold">
                                  {exercise.name}
                                </td>
                                <td className="px-3 py-3">{exercise.sets}</td>
                                <td className="px-3 py-3">{exercise.repetitions}</td>
                                <td className="px-3 py-3">
                                  {exercise.weight === null
                                    ? "—"
                                    : `${exercise.weight} kg`}
                                </td>
                                <td className="px-3 py-3">
                                  {exercise.restSeconds === null
                                    ? "—"
                                    : `${exercise.restSeconds} s`}
                                </td>
                                <td className="px-3 py-3 text-zinc-400">
                                  <span className="line-clamp-2">
                                    {exercise.observations || "—"}
                                  </span>
                                </td>
                                <td className="px-3 py-3">
                                  {exercise.videoUrl ? (
                                    <a
                                      href={exercise.videoUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-bold text-yellow-300"
                                    >
                                      Ver
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </article>
            );
          })}
          <section aria-label="Métricas y distribución de la rutina" className="rounded-2xl border border-yellow-400/15 bg-gradient-to-br from-yellow-400/[.055] to-zinc-950 p-4 sm:p-5">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <RoutineMetric label="Series de fuerza" value={metrics.totalSeries} />
              <RoutineMetric label="Días" value={metrics.totalDays} />
              <RoutineMetric label="Ejercicios" value={metrics.totalExercises} />
              <RoutineMetric label="Bloques" value={metrics.totalBlocks} />
              <RoutineMetric label="Circuitos" value={metrics.circuits} />
              <RoutineMetric label="Min. programados" value={metrics.programmedMinutes} />
            </div>
            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
              <div>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[.14em] text-yellow-300">Distribución semanal</p>
                    <p className="mt-1 text-xs text-zinc-500">Series configuradas por grupo muscular.</p>
                  </div>
                </div>
                {metrics.weeklyDistribution.length ? <div className="mt-4 space-y-3">{metrics.weeklyDistribution.map((item) => <div key={item.muscleGroup}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-zinc-200">{item.muscleGroup}</span><span className="shrink-0 text-zinc-400">{item.series} series · {Math.round(item.percentage)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300" style={{ width: `${item.percentage}%` }} /></div></div>)}</div> : <p className="mt-4 rounded-xl border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">No hay series configuradas.</p>}
              </div>
              <details className="self-start rounded-xl border border-zinc-800 bg-black/30">
                <summary className="cursor-pointer list-none px-3 py-3 text-sm font-bold text-yellow-300">Ver desglose por día</summary>
                <div className="divide-y divide-zinc-800 border-t border-zinc-800">{metrics.perDay.map((day) => <div key={day.id} className="px-3 py-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-semibold">Día {day.dayNumber} · {day.name}</p><p className="mt-1 text-xs text-zinc-500">{day.totalExercises} ejercicios</p></div><span className="shrink-0 rounded-lg bg-yellow-400/10 px-2 py-1 text-xs font-bold text-yellow-300">{day.totalSeries} series</span></div>{day.distribution.length > 0 && <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">{day.distribution.map((item) => `${item.muscleGroup}: ${item.series}`).join(" · ")}</p>}</div>)}</div>
              </details>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function RoutineMetric({ label: title, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-zinc-800 bg-black/35 px-2 py-3 text-center sm:px-4"><p className="text-[10px] leading-tight text-zinc-500">{title}</p><p className="mt-1 text-xl font-black text-yellow-300 sm:text-2xl">{value}</p></div>;
}
