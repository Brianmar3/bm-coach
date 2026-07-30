"use client";

import { useEffect, useMemo, useState } from "react";
import type { UnifiedExerciseRecord } from "@/types/exercise-record";
import type { QuickLog } from "@/types/quick-log";

const feedbackPresets = [
  "Buen progreso.",
  "Mantener carga.",
  "Subir carga próxima sesión.",
  "Mejorar técnica.",
  "Reducir carga.",
  "Revisar ejecución.",
] as const;

type ReviewFilter = "all" | "marks" | "unreviewed" | "feedback";

const sourcePath = {
  QUICK_LOG: "quick",
  CLASS: "class",
} as const;

const markLabel = {
  FIRST_MARK: "Primera marca",
  MAX_LOAD: "Nueva carga máxima",
  REPETITION_PR: "Más repeticiones",
} as const;

export function AdminQuickLogSummary({ studentId }: { studentId: string }) {
  const [records, setRecords] = useState<UnifiedExerciseRecord[]>([]);
  const [quickLogs, setQuickLogs] = useState<QuickLog[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState<ReviewFilter>("all");
  const [exerciseFilter, setExerciseFilter] = useState("");
  const [feedbacking, setFeedbacking] =
    useState<UnifiedExerciseRecord | null>(null);
  const [editing, setEditing] = useState<QuickLog | null>(null);

  async function load() {
    setError("");
    const [recordResponse, quickResponse] = await Promise.all([
      fetch(`/api/admin/alumnos/${studentId}/exercise-records`, {
        cache: "no-store",
      }),
      fetch(`/api/admin/alumnos/${studentId}/quick-logs`, {
        cache: "no-store",
      }),
    ]);
    const recordBody = (await recordResponse.json()) as {
      records?: UnifiedExerciseRecord[];
      error?: string;
    };
    const quickBody = (await quickResponse.json()) as {
      logs?: QuickLog[];
      error?: string;
    };
    if (!recordResponse.ok || !quickResponse.ok) {
      setError(
        recordBody.error ??
          quickBody.error ??
          "No se pudieron cargar los registros.",
      );
      return;
    }
    setRecords(recordBody.records ?? []);
    setQuickLogs(quickBody.logs ?? []);
  }

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/admin/alumnos/${studentId}/exercise-records`, {
        cache: "no-store",
        signal: controller.signal,
      }),
      fetch(`/api/admin/alumnos/${studentId}/quick-logs`, {
        cache: "no-store",
        signal: controller.signal,
      }),
    ])
      .then(async ([recordResponse, quickResponse]) => {
        const recordBody = (await recordResponse.json()) as {
          records?: UnifiedExerciseRecord[];
          error?: string;
        };
        const quickBody = (await quickResponse.json()) as {
          logs?: QuickLog[];
          error?: string;
        };
        if (!recordResponse.ok || !quickResponse.ok) {
          throw new Error(
            recordBody.error ??
              quickBody.error ??
              "No se pudieron cargar los registros.",
          );
        }
        setRecords(recordBody.records ?? []);
        setQuickLogs(quickBody.logs ?? []);
      })
      .catch((reason: unknown) => {
        if (!(reason instanceof Error && reason.name === "AbortError")) {
          setError(
            reason instanceof Error
              ? reason.message
              : "No se pudieron cargar los registros.",
          );
        }
      });
    return () => controller.abort();
  }, [studentId]);

  const exercises = useMemo(() => {
    const grouped = new Map<string, { name: string; count: number }>();
    for (const record of records) {
      const current = grouped.get(record.exerciseKey);
      grouped.set(record.exerciseKey, {
        name: current?.name ?? record.exerciseName,
        count: (current?.count ?? 0) + 1,
      });
    }
    return [...grouped.entries()]
      .map(([key, value]) => ({ key, ...value }))
      .sort((left, right) => right.count - left.count);
  }, [records]);

  const filtered = useMemo(
    () =>
      records.filter((record) => {
        if (exerciseFilter && record.exerciseKey !== exerciseFilter) {
          return false;
        }
        if (filter === "marks") return record.marks.length > 0;
        if (filter === "unreviewed") {
          return record.source !== "ROUTINE" && !record.feedback;
        }
        if (filter === "feedback") return Boolean(record.feedback);
        return true;
      }),
    [exerciseFilter, filter, records],
  );

  const quickById = useMemo(
    () => new Map(quickLogs.map((log) => [log.id, log])),
    [quickLogs],
  );
  const otherPersonalLogs = quickLogs.filter(
    (log) =>
      !(
        log.type === "PROGRESS" &&
        log.metricType === "carga" &&
        log.currentValue !== null
      ),
  );

  async function removeQuickLog(log: QuickLog) {
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
            {records.length
              ? `${records.length} marcas · ${records.filter((record) => record.source !== "ROUTINE" && !record.feedback).length} sin devolución`
              : "Sin registros de ejercicios"}
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
            <Metric
              label="Nuevas marcas"
              value={String(
                records.filter((record) => record.marks.length > 0).length,
              )}
            />
            <Metric
              label="Sin revisar"
              value={String(
                records.filter(
                  (record) =>
                    record.source !== "ROUTINE" && !record.feedback,
                ).length,
              )}
            />
            <Metric
              label="Ejercicio frecuente"
              value={exercises[0]?.name ?? "Sin registros"}
            />
          </div>
          {records.slice(0, 3).map((record) => (
            <p
              key={record.id}
              className="mt-2 truncate text-sm text-zinc-400"
            >
              {record.exerciseName} · {record.sets} × {record.repetitions} ·{" "}
              {formatLoad(record.load, record.unit)} · {record.originLabel}
            </p>
          ))}
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
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
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
            {filtered.map((record) => (
              <RecordCard
                key={record.id}
                record={record}
                feedback={
                  record.source === "QUICK_LOG"
                    ? () => setFeedbacking(record)
                    : undefined
                }
                editQuick={
                  record.source === "QUICK_LOG"
                    ? () =>
                        setEditing(quickById.get(record.sourceId) ?? null)
                    : undefined
                }
                removeQuick={
                  record.source === "QUICK_LOG"
                    ? () => {
                        const log = quickById.get(record.sourceId);
                        if (log) void removeQuickLog(log);
                      }
                    : undefined
                }
              />
            ))}
            {!filtered.length && (
              <p className="rounded-xl border border-dashed border-zinc-800 p-6 text-center text-sm text-zinc-500">
                No hay registros para este filtro.
              </p>
            )}
          </div>
          {otherPersonalLogs.length > 0 && (
            <details className="mt-5 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
              <summary className="cursor-pointer text-sm font-bold text-zinc-300">
                Otros registros personales ({otherPersonalLogs.length})
              </summary>
              <div className="mt-3 space-y-2">
                {otherPersonalLogs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start justify-between gap-3 rounded-lg bg-zinc-950 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">
                        {log.title || log.content || "Registro personal"}
                      </p>
                      <p className="mt-1 text-xs text-zinc-500">
                        {showDate(log.date)} · {log.type}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2 text-xs">
                      <button
                        onClick={() => setEditing(log)}
                        className="text-yellow-300"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => void removeQuickLog(log)}
                        className="text-red-300"
                      >
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {feedbacking && (
        <FeedbackForm
          record={feedbacking}
          studentId={studentId}
          close={() => setFeedbacking(null)}
          saved={async (message) => {
            setFeedbacking(null);
            setNotice(message);
            await load();
          }}
        />
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
    </section>
  );
}

function RecordCard({
  record,
  feedback,
  editQuick,
  removeQuick,
}: {
  record: UnifiedExerciseRecord;
  feedback?: () => void;
  editQuick?: () => void;
  removeQuick?: () => void;
}) {
  return (
    <article className="rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-yellow-400">
            {record.originLabel}
          </p>
          <h4 className="mt-1 break-words font-bold uppercase">
            {record.exerciseName}
          </h4>
          <p className="mt-1 text-xs text-zinc-500">
            {showDate(record.date)} · {record.context}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 text-xs">
          {feedback && (
            <button onClick={feedback} className="text-emerald-300">
              {record.feedback ? "Editar devolución" : "Dejar devolución"}
            </button>
          )}
          {editQuick && (
            <button onClick={editQuick} className="text-yellow-300">
              Editar
            </button>
          )}
          {removeQuick && (
            <button onClick={removeQuick} className="text-red-300">
              Eliminar
            </button>
          )}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric
          label="Carga"
          value={formatLoad(record.load, record.unit)}
          highlight
        />
        <Metric label="Series × reps" value={`${record.sets} × ${record.repetitions}`} />
        <Metric
          label="Anterior"
          value={
            record.previous
              ? `${record.previous.sets} × ${record.previous.repetitions} · ${formatLoad(record.previous.load, record.previous.unit)}`
              : "Primera marca"
          }
        />
        <Metric
          label="Diferencia"
          value={
            record.difference === null
              ? "Sin comparación"
              : `${record.difference > 0 ? "+" : ""}${record.difference.toLocaleString("es-AR")} ${record.unit}`
          }
        />
      </div>
      {record.setDetails.length > 1 && (
        <p className="mt-2 text-xs text-zinc-500">
          Series:{" "}
          {record.setDetails
            .map(
              (set) =>
                `${formatLoad(set.weight, set.unit)} × ${set.repetitions}`,
            )
            .join(" · ")}
        </p>
      )}
      <p className="mt-2 text-xs text-zinc-500">
        {record.recordedByLabel}
      </p>
      {record.marks.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {record.marks.map((mark) => (
            <span
              key={mark}
              className="rounded-full border border-yellow-400/20 bg-yellow-400/[.06] px-2 py-1 text-[10px] font-bold text-yellow-200"
            >
              {markLabel[mark]}
            </span>
          ))}
        </div>
      )}
      {record.feedback && (
        <div className="mt-3 rounded-lg border border-emerald-400/15 bg-emerald-400/[.04] p-2">
          <p className="text-[10px] font-bold uppercase text-emerald-300">
            Devolución enviada
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            {record.feedback.text}
          </p>
        </div>
      )}
    </article>
  );
}

function Metric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-black/55 p-2">
      <p className="text-[9px] uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p
        className={`mt-1 break-words text-sm font-semibold ${
          highlight ? "text-yellow-300" : "text-zinc-200"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function FeedbackForm({
  record,
  studentId,
  close,
  saved,
}: {
  record: UnifiedExerciseRecord;
  studentId: string;
  close: () => void;
  saved: (message: string) => Promise<void>;
}) {
  const [preset, setPreset] = useState(record.feedback?.preset ?? "");
  const initialCustom =
    record.feedback?.text && record.feedback.preset
      ? record.feedback.text.slice(record.feedback.preset.length).trim()
      : (record.feedback?.text ?? "");
  const [text, setText] = useState(initialCustom);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (record.source === "ROUTINE") return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/alumnos/${studentId}/exercise-records/${sourcePath[record.source]}/${record.sourceId}/feedback`,
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
              Devolución · {record.originLabel}
            </p>
            <h3 className="mt-1 font-bold">{record.exerciseName}</h3>
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
            className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white outline-none focus:border-yellow-400"
          />
        </label>
        {error && (
          <p className="mt-3 rounded-lg bg-red-400/10 p-3 text-sm text-red-200">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={saving || (!preset && !text.trim())}
          className="mt-4 min-h-12 w-full rounded-xl bg-yellow-400 font-bold text-zinc-950 disabled:opacity-50"
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

function formatLoad(value: number, unit: string) {
  return `${value.toLocaleString("es-AR")} ${unit || "kg"}`;
}

function showDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString(
    "es-AR",
  );
}
