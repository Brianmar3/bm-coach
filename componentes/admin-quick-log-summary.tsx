"use client";
/* eslint-disable @next/next/no-img-element -- validated Blob URLs */

import { useEffect, useMemo, useState } from "react";
import type { QuickLog } from "@/types/quick-log";

const typeLabel = {
  WORKOUT: "Entrenamiento",
  NOTE: "Nota",
  PROGRESS: "Progreso",
  PHOTO: "Foto",
} as const;

const feedbackPresets = [
  "Buen progreso.",
  "Mantener carga.",
  "Subir carga próxima sesión.",
  "Mejorar técnica.",
  "Reducir carga.",
  "Revisar ejecución.",
] as const;

function isStrengthLog(log: QuickLog) {
  return (
    log.type === "PROGRESS" &&
    log.metricType === "carga" &&
    log.sets !== null &&
    log.repetitions !== null
  );
}

function strengthSummary(log: QuickLog) {
  if (!isStrengthLog(log)) return null;
  const unit = log.unit || "kg";
  const difference =
    log.previousValue !== null && log.currentValue !== null
      ? log.currentValue - log.previousValue
      : null;
  return {
    work: `${log.sets} × ${log.repetitions}`,
    load: `${log.currentValue?.toLocaleString("es-AR")} ${unit}`,
    previous:
      log.previousValue === null
        ? "Sin registro anterior"
        : `${log.previousValue.toLocaleString("es-AR")} ${unit}`,
    previousWork:
      log.previousSets !== null && log.previousRepetitions !== null
        ? `${log.previousSets} × ${log.previousRepetitions}`
        : "",
    difference:
      difference === null
        ? ""
        : difference === 0
          ? "Sin cambios"
          : `${difference > 0 ? "+" : ""}${difference.toLocaleString("es-AR")} ${unit}`,
  };
}

type ReviewFilter = "all" | "marks" | "unreviewed" | "feedback";

export function AdminQuickLogSummary({ studentId }: { studentId: string }) {
  const [logs, setLogs] = useState<QuickLog[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<QuickLog | null>(null);
  const [feedbacking, setFeedbacking] = useState<QuickLog | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [exerciseFilter, setExerciseFilter] = useState("");

  async function load() {
    const response = await fetch(
      `/api/admin/alumnos/${studentId}/quick-logs`,
      { cache: "no-store" },
    );
    const body = (await response.json()) as {
      logs?: QuickLog[];
      error?: string;
    };
    if (!response.ok) {
      setError(body.error ?? "No se pudo cargar el registro personal.");
      return;
    }
    setLogs(body.logs ?? []);
  }

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/admin/alumnos/${studentId}/quick-logs`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as {
          logs?: QuickLog[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(
            body.error ?? "No se pudo cargar el registro personal.",
          );
        }
        setLogs(body.logs ?? []);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof Error && reason.name === "AbortError")) {
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudo cargar el registro personal.",
          );
        }
      });
    return () => controller.abort();
  }, [studentId]);

  const exercises = useMemo(() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const log of logs.filter(isStrengthLog)) {
      const key =
        log.exerciseKey || log.exerciseName.trim().toLocaleLowerCase("es");
      const current = counts.get(key);
      counts.set(key, {
        name: current?.name ?? log.exerciseName,
        count: (current?.count ?? 0) + 1,
      });
    }
    return [...counts.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((left, right) => right.count - left.count);
  }, [logs]);

  const filteredLogs = useMemo(
    () =>
      logs.filter((log) => {
        const key =
          log.exerciseKey || log.exerciseName.trim().toLocaleLowerCase("es");
        if (exerciseFilter && key !== exerciseFilter) return false;
        if (filter === "marks") return log.achievements.length > 0;
        if (filter === "unreviewed") {
          return isStrengthLog(log) && !log.feedback;
        }
        if (filter === "feedback") return Boolean(log.feedback);
        return true;
      }),
    [exerciseFilter, filter, logs],
  );

  async function remove(log: QuickLog) {
    if (
      !window.confirm(
        "¿Eliminar este registro personal? Esta acción no se puede deshacer.",
      )
    ) {
      return;
    }
    const response = await fetch(
      `/api/admin/alumnos/${studentId}/quick-logs`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logId: log.id }),
      },
    );
    const body = (await response.json()) as {
      error?: string;
      message?: string;
    };
    if (!response.ok) {
      setError(body.error ?? "No se pudo eliminar.");
      return;
    }
    setNotice(body.message ?? "Registro eliminado.");
    await load();
  }

  return (
    <section className="mt-5 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold">Registros y marcas</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {logs.length
              ? `${logs.length} registros · ${logs.filter((log) => isStrengthLog(log) && !log.feedback).length} sin devolución`
              : "Sin registros"}
          </p>
        </div>
        <button
          onClick={() => setOpen((value) => !value)}
          className="text-sm font-bold text-yellow-400"
        >
          {open ? "Ocultar" : "Ver historial completo"}
        </button>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {notice && <p className="mt-3 text-sm text-emerald-300">{notice}</p>}

      {!open && (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <AdminMetric
              label="Nuevas marcas"
              value={String(
                logs.filter((log) => log.achievements.length > 0).length,
              )}
            />
            <AdminMetric
              label="Sin revisar"
              value={String(
                logs.filter((log) => isStrengthLog(log) && !log.feedback)
                  .length,
              )}
            />
            <AdminMetric
              label="Ejercicio frecuente"
              value={exercises[0]?.name ?? "Sin registros"}
            />
          </div>
          {logs.slice(0, 3).map((log) => {
            const strength = strengthSummary(log);
            return (
              <p key={log.id} className="mt-2 truncate text-sm text-zinc-400">
                {isStrengthLog(log) ? "Ejercicio" : typeLabel[log.type]} ·{" "}
                {log.title || log.content || log.exerciseName}
                {strength ? ` · ${strength.work} · ${strength.load}` : ""}
              </p>
            );
          })}
        </>
      )}

      {open && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            {(
              [
                ["all", "Todos"],
                ["marks", "Nuevas marcas"],
                ["unreviewed", "Sin revisar"],
                ["feedback", "Con devolución"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`min-h-10 rounded-full border px-3 text-xs font-bold ${
                  filter === value
                    ? "border-yellow-400/30 bg-yellow-400/10 text-yellow-200"
                    : "border-zinc-800 text-zinc-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {exercises.length > 0 && (
            <div
              className="mt-3 flex gap-2 overflow-x-auto pb-1"
              aria-label="Historial por ejercicio"
            >
              <button
                type="button"
                onClick={() => setExerciseFilter("")}
                className={`min-h-9 shrink-0 rounded-full px-3 text-xs ${
                  !exerciseFilter
                    ? "bg-zinc-200 text-zinc-950"
                    : "bg-zinc-900 text-zinc-400"
                }`}
              >
                Todos los ejercicios
              </button>
              {exercises.map((exercise) => (
                <button
                  key={exercise.key}
                  type="button"
                  onClick={() => setExerciseFilter(exercise.key)}
                  className={`min-h-9 shrink-0 rounded-full px-3 text-xs ${
                    exerciseFilter === exercise.key
                      ? "bg-zinc-200 text-zinc-950"
                      : "bg-zinc-900 text-zinc-400"
                  }`}
                >
                  {exercise.name} ({exercise.count})
                </button>
              ))}
            </div>
          )}
          <div className="mt-4 space-y-3">
            {filteredLogs.map((log) => (
              <AdminLogCard
                key={log.id}
                log={log}
                edit={() => setEditing(log)}
                remove={() => remove(log)}
                feedback={() => setFeedbacking(log)}
              />
            ))}
            {!filteredLogs.length && (
              <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
                No hay registros para este filtro.
              </p>
            )}
          </div>
        </>
      )}

      {editing && (
        <AdminEdit
          log={editing}
          studentId={studentId}
          close={() => setEditing(null)}
          saved={async () => {
            setEditing(null);
            setNotice("Registro actualizado correctamente.");
            await load();
          }}
        />
      )}
      {feedbacking && (
        <FeedbackForm
          log={feedbacking}
          studentId={studentId}
          close={() => setFeedbacking(null)}
          saved={async (message) => {
            setFeedbacking(null);
            setNotice(message);
            await load();
          }}
        />
      )}
    </section>
  );
}

function AdminLogCard({
  log,
  edit,
  remove,
  feedback,
}: {
  log: QuickLog;
  edit: () => void;
  remove: () => void;
  feedback: () => void;
}) {
  const strength = strengthSummary(log);
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-yellow-300">
            {isStrengthLog(log) ? "Ejercicio" : typeLabel[log.type]} ·{" "}
            {new Date(`${log.date}T12:00:00`).toLocaleDateString("es-AR")}
          </p>
          <p className="mt-1 break-words font-semibold">
            {log.title || log.exerciseName || typeLabel[log.type]}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-xs">
          {isStrengthLog(log) && (
            <button onClick={feedback} className="text-emerald-300">
              {log.feedback ? "Editar devolución" : "Dejar devolución"}
            </button>
          )}
          <button onClick={edit} className="text-yellow-300">
            Editar
          </button>
          <button onClick={remove} className="text-red-300">
            Eliminar
          </button>
        </div>
      </div>
      {log.achievements.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {log.achievements.map((achievement) => (
            <span
              key={achievement.id}
              className="rounded-full bg-yellow-400/10 px-2 py-1 text-[10px] font-bold text-yellow-200"
            >
              {achievement.type === "MAX_LOAD"
                ? "Nueva carga máxima"
                : achievement.type === "FIRST_MARK"
                  ? "Primera marca"
                  : achievement.type === "REPETITION_PR"
                    ? "Más repeticiones"
                    : `${achievement.recordCount} registros`}
            </span>
          ))}
        </div>
      )}
      {strength && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <AdminMetric label="Series × reps" value={strength.work} />
          <AdminMetric label="Carga" value={strength.load} />
          <div className="col-span-2 rounded-lg bg-black/55 p-2">
            <p className="text-[10px] uppercase text-zinc-500">
              Evolución de carga
            </p>
            <p className="text-sm">
              {strength.previousWork ? `${strength.previousWork} · ` : ""}
              {strength.previous}
              {strength.difference ? ` · ${strength.difference}` : ""}
            </p>
          </div>
        </div>
      )}
      {log.feedback && (
        <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-400/[.04] p-2">
          <p className="text-[10px] font-bold uppercase text-emerald-300">
            Devolución enviada
          </p>
          <p className="mt-1 text-sm text-zinc-300">{log.feedback.text}</p>
        </div>
      )}
      {log.content && (
        <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-400">
          {log.content}
        </p>
      )}
      {log.hasPain && (
        <p className="mt-2 text-xs text-red-300">
          Molestia: {log.painDetails || "Sin detalle"}
        </p>
      )}
      {log.photos.length > 0 && (
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {log.photos.map((photo) => (
            <img
              key={photo.id}
              src={photo.blobUrl}
              alt=""
              className="h-20 w-20 shrink-0 rounded-lg object-cover"
            />
          ))}
        </div>
      )}
    </article>
  );
}

function AdminMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-zinc-900 p-2">
      <p className="text-[9px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-semibold text-zinc-200">
        {value}
      </p>
    </div>
  );
}

function FeedbackForm({
  log,
  studentId,
  close,
  saved,
}: {
  log: QuickLog;
  studentId: string;
  close: () => void;
  saved: (message: string) => Promise<void>;
}) {
  const [preset, setPreset] = useState(log.feedback?.preset ?? "");
  const initialCustom =
    log.feedback?.text && log.feedback.preset
      ? log.feedback.text.slice(log.feedback.preset.length).trim()
      : (log.feedback?.text ?? "");
  const [text, setText] = useState(initialCustom);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/alumnos/${studentId}/quick-logs/${log.id}/feedback`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preset, text }),
        },
      );
      const body = (await response.json()) as {
        error?: string;
        message?: string;
      };
      if (!response.ok) {
        throw new Error(
          body.error ?? "No se pudo guardar la devolución.",
        );
      }
      await saved(body.message ?? "Devolución guardada correctamente.");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo guardar la devolución.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-black/85 p-3"
      onMouseDown={(event) =>
        event.target === event.currentTarget && close()
      }
    >
      <div className="mx-auto my-5 w-full max-w-lg rounded-2xl border border-yellow-400/15 bg-zinc-900 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:my-10 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-yellow-400">
              Devolución
            </p>
            <h3 className="mt-1 font-bold">
              {log.exerciseName || log.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="min-h-10 px-2 text-sm text-zinc-400"
          >
            Cerrar
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {feedbackPresets.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() =>
                setPreset((value) => (value === option ? "" : option))
              }
              className={`min-h-11 rounded-xl border px-2 text-left text-xs ${
                preset === option
                  ? "border-yellow-400/35 bg-yellow-400/10 text-yellow-200"
                  : "border-zinc-700 bg-zinc-950 text-zinc-300"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <label className="mt-4 block text-sm text-zinc-300">
          Comentario personalizado
          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            maxLength={600}
            rows={3}
            placeholder="Comentario breve opcional"
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none focus:border-yellow-400"
          />
        </label>
        {error && (
          <p
            role="alert"
            className="mt-3 rounded-lg bg-red-400/10 p-3 text-sm text-red-200"
          >
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={saving || (!preset && !text.trim())}
          className="mt-4 min-h-12 w-full rounded-xl bg-yellow-400 px-4 font-bold text-zinc-950 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar devolución"}
        </button>
      </div>
    </div>
  );
}

function AdminEdit({
  log,
  studentId,
  close,
  saved,
}: {
  log: QuickLog;
  studentId: string;
  close: () => void;
  saved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(log.title);
  const [content, setContent] = useState(log.content);
  const [category, setCategory] = useState(log.category);
  const [painDetails, setPainDetails] = useState(log.painDetails);
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const response = await fetch(
      `/api/admin/alumnos/${studentId}/quick-logs`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logId: log.id,
          title,
          content,
          category,
          painDetails,
        }),
      },
    );
    if (response.ok) await saved();
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/85 p-3">
      <div className="mx-auto my-8 max-w-lg rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="flex justify-between">
          <h3 className="font-bold">Editar registro personal</h3>
          <button onClick={close}>Cerrar</button>
        </div>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Título"
          className="mt-4 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3"
        />
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Categoría"
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3"
        />
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          rows={5}
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3"
        />
        <textarea
          value={painDetails}
          onChange={(event) => setPainDetails(event.target.value)}
          rows={2}
          placeholder="Molestias"
          className="mt-3 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3"
        />
        <button
          disabled={saving}
          onClick={submit}
          className="mt-4 w-full rounded-xl bg-yellow-400 p-3 font-bold text-zinc-950"
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>
    </div>
  );
}
