"use client";

import { useState, type ReactNode } from "react";
import type { TrainingExercise, TrainingRoutine } from "@/types/gestion";

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

export function RoutineTableView({
  routine,
  close,
  actions,
}: RoutineTableViewProps) {
  const firstDay = routine.days[0]?.id ?? "";
  const [openDayId, setOpenDayId] = useState(firstDay);

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
                  {day.exercises.length === 0 ? (
                    <p className="p-5 text-sm text-zinc-500">
                      Descanso o sin ejercicios planificados.
                    </p>
                  ) : (
                    <>
                      <div className="divide-y divide-zinc-800 md:hidden">
                        {day.exercises.map((exercise) => (
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
                            {day.exercises.map((exercise, index) => (
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
        </div>
      </section>
    </div>
  );
}
