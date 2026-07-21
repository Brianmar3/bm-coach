"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import type { PhysicalEvaluation, Student } from "@/types/gestion";

type EvaluationDraft = Omit<PhysicalEvaluation, "id" | "studentName" | "bmi" | "createdAt">;
type NumericEvaluationKey = keyof Pick<EvaluationDraft,
  "weight" | "height" | "bodyFatPercentage" | "muscleMass" | "visceralFat" |
  "waist" | "hip" | "chest" | "rightArm" | "leftArm" | "rightThigh" |
  "leftThigh" | "rightCalf" | "leftCalf"
>;

const today = () => new Date().toISOString().slice(0, 10);
const blankEvaluation = (studentId = ""): EvaluationDraft => ({
  studentId,
  date: today(),
  weight: null,
  height: null,
  bodyFatPercentage: null,
  muscleMass: null,
  visceralFat: null,
  waist: null,
  hip: null,
  chest: null,
  rightArm: null,
  leftArm: null,
  rightThigh: null,
  leftThigh: null,
  rightCalf: null,
  leftCalf: null,
  notes: "",
  frontPhotoUrl: "",
  sidePhotoUrl: "",
  backPhotoUrl: "",
});

const perimeterFields: Array<{ key: NumericEvaluationKey; label: string }> = [
  { key: "waist", label: "Cintura" },
  { key: "hip", label: "Cadera" },
  { key: "chest", label: "Pecho" },
  { key: "rightArm", label: "Brazo derecho" },
  { key: "leftArm", label: "Brazo izquierdo" },
  { key: "rightThigh", label: "Muslo derecho" },
  { key: "leftThigh", label: "Muslo izquierdo" },
  { key: "rightCalf", label: "Pantorrilla derecha" },
  { key: "leftCalf", label: "Pantorrilla izquierda" },
];

function showDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("es-AR");
}

function showNumber(value: number | null, suffix = "") {
  return value === null ? "—" : `${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}${suffix}`;
}

function difference(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;
  return Math.round((current - previous) * 100) / 100;
}

function showDifference(value: number | null, suffix: string) {
  if (value === null) return "Sin comparación";
  if (value === 0) return `Sin cambios (${showNumber(0, suffix)})`;
  return `${value > 0 ? "+" : ""}${showNumber(value, suffix)}`;
}

async function responseError(response: Response, fallback: string) {
  try {
    return ((await response.json()) as { error?: string }).error ?? fallback;
  } catch {
    return fallback;
  }
}

export default function EvaluacionesPage() {
  const [items, setItems] = useState<PhysicalEvaluation[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [form, setForm] = useState<EvaluationDraft>(blankEvaluation());
  const [editing, setEditing] = useState<PhysicalEvaluation | null>(null);
  const [viewing, setViewing] = useState<PhysicalEvaluation | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch("/api/evaluaciones", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar las evaluaciones."));
        return response.json() as Promise<PhysicalEvaluation[]>;
      }),
      fetch("/api/alumnos", { signal: controller.signal, cache: "no-store" }).then(async (response) => {
        if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los alumnos."));
        return response.json() as Promise<Student[]>;
      }),
    ]).then(([evaluations, realStudents]) => {
      setItems(evaluations);
      setStudents(realStudents);
      setSelectedStudentId(evaluations[0]?.studentId ?? realStudents[0]?.id ?? "");
    }).catch((loadError: unknown) => {
      if (loadError instanceof Error && loadError.name !== "AbortError") setError(loadError.message);
    }).finally(() => setReady(true));
    return () => controller.abort();
  }, []);

  const history = useMemo(() => items
    .filter((item) => item.studentId === selectedStudentId)
    .sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`)), [items, selectedStudentId]);
  const latest = history[0] ?? null;
  const previous = history[1] ?? null;
  const selectedStudent = students.find((student) => student.id === selectedStudentId);

  function begin(item?: PhysicalEvaluation) {
    if (!item && students.length === 0) {
      setError("Primero necesitás crear un alumno real para registrar una evaluación.");
      return;
    }
    setEditing(item ?? null);
    setForm(item ? {
      studentId: item.studentId,
      date: item.date,
      weight: item.weight,
      height: item.height,
      bodyFatPercentage: item.bodyFatPercentage,
      muscleMass: item.muscleMass,
      visceralFat: item.visceralFat,
      waist: item.waist,
      hip: item.hip,
      chest: item.chest,
      rightArm: item.rightArm,
      leftArm: item.leftArm,
      rightThigh: item.rightThigh,
      leftThigh: item.leftThigh,
      rightCalf: item.rightCalf,
      leftCalf: item.leftCalf,
      notes: item.notes,
      frontPhotoUrl: item.frontPhotoUrl,
      sidePhotoUrl: item.sidePhotoUrl,
      backPhotoUrl: item.backPhotoUrl,
    } : blankEvaluation(selectedStudentId || students[0].id));
    setError("");
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.studentId || !form.date) {
      setError("Seleccioná un alumno e ingresá la fecha.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(editing ? `/api/evaluaciones/${editing.id}` : "/api/evaluaciones", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo guardar la evaluación."));
      const saved = (await response.json()) as PhysicalEvaluation;
      setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setSelectedStudentId(saved.studentId);
      setOpen(false);
      setEditing(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la evaluación en Neon.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: PhysicalEvaluation) {
    if (!window.confirm(`¿Eliminar la evaluación de ${item.studentName} del ${showDate(item.date)}?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/evaluaciones/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo eliminar la evaluación."));
      setItems((current) => current.filter((evaluation) => evaluation.id !== item.id));
      if (viewing?.id === item.id) setViewing(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la evaluación de Neon.");
    }
  }

  return <ModuleShell title="Evaluaciones físicas" subtitle="Seguimiento corporal e historial real de cada alumno." action={<button onClick={() => begin()} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300">+ Nueva evaluación</button>}>
    {error && !open && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}

    <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <label className="w-full max-w-md text-sm text-zinc-300">Historial del alumno
          <select value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)} className={`${inputClass} mt-1`}>
            {students.length === 0 && <option value="">Sin alumnos disponibles</option>}
            {students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}
          </select>
        </label>
        <p className="text-sm text-zinc-500">{selectedStudent ? `${history.length} evaluación${history.length === 1 ? "" : "es"} registrada${history.length === 1 ? "" : "s"}` : "Seleccioná un alumno"}</p>
      </div>
    </section>

    {!ready ? <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-500">Cargando evaluaciones…</section> : <>
      <Comparison latest={latest} previous={previous} />
      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <LineChart title="Evolución de peso" items={history} field="weight" unit="kg" color="#facc15" />
        <LineChart title="Grasa corporal" items={history} field="bodyFatPercentage" unit="%" color="#fb7185" />
        <LineChart title="Masa muscular" items={history} field="muscleMass" unit="kg" color="#34d399" />
      </section>
      <HistoryTable items={history} onView={setViewing} onEdit={begin} onRemove={remove} />
    </>}

    {open && <EvaluationForm form={form} setForm={setForm} students={students} error={error} close={() => setOpen(false)} submit={submit} editing={Boolean(editing)} saving={saving} />}
    {viewing && <EvaluationDetail item={viewing} close={() => setViewing(null)} />}
  </ModuleShell>;
}

function Comparison({ latest, previous }: { latest: PhysicalEvaluation | null; previous: PhysicalEvaluation | null }) {
  if (!latest) return <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 p-8 text-center"><h2 className="font-semibold text-white">Sin evaluaciones para este alumno</h2><p className="mt-2 text-sm text-zinc-500">Registrá la primera medición para comenzar el historial.</p></section>;
  return <section className="grid gap-5 xl:grid-cols-3">
    <article className="rounded-2xl border border-yellow-400/25 bg-yellow-400/5 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Evaluación más reciente</p>
      <h2 className="mt-2 text-xl font-bold">{showDate(latest.date)}</h2>
      <div className="mt-5 grid grid-cols-2 gap-4 text-sm"><Metric label="Peso" value={showNumber(latest.weight, " kg")} /><Metric label="Altura" value={showNumber(latest.height, " m")} /><Metric label="IMC" value={showNumber(latest.bmi)} /><Metric label="Grasa" value={showNumber(latest.bodyFatPercentage, "%")} /><Metric label="Músculo" value={showNumber(latest.muscleMass, " kg")} /><Metric label="Grasa visceral" value={showNumber(latest.visceralFat)} /></div>
    </article>
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Comparación anterior</p>
      <p className="mt-2 text-sm text-zinc-400">{previous ? `Contra el ${showDate(previous.date)}` : "Todavía no existe una evaluación anterior."}</p>
      <div className="mt-5 space-y-3"><DeltaRow label="Peso" value={difference(latest.weight, previous?.weight ?? null)} suffix=" kg" /><DeltaRow label="Grasa corporal" value={difference(latest.bodyFatPercentage, previous?.bodyFatPercentage ?? null)} suffix="%" /><DeltaRow label="Masa muscular" value={difference(latest.muscleMass, previous?.muscleMass ?? null)} suffix=" kg" /></div>
    </article>
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">Diferencia de perímetros</p>
      <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2">{perimeterFields.map((field) => <DeltaRow key={field.key} label={field.label} value={difference(latest[field.key], previous?.[field.key] ?? null)} suffix=" cm" compact />)}</div>
    </article>
  </section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 font-semibold text-white">{value}</p></div>;
}

function DeltaRow({ label, value, suffix, compact = false }: { label: string; value: number | null; suffix: string; compact?: boolean }) {
  const tone = value === null || value === 0 ? "text-zinc-500" : value > 0 ? "text-amber-300" : "text-sky-300";
  return <div className={`${compact ? "block" : "flex items-center justify-between"} text-sm`}><span className="text-zinc-400">{label}</span><span className={`${tone} ${compact ? "block text-xs" : "font-semibold"}`}>{showDifference(value, suffix)}</span></div>;
}

function LineChart({ title, items, field, unit, color }: { title: string; items: PhysicalEvaluation[]; field: "weight" | "bodyFatPercentage" | "muscleMass"; unit: string; color: string }) {
  const data = [...items].reverse().flatMap((item) => item[field] === null ? [] : [{ date: item.date, value: item[field] as number }]);
  if (data.length === 0) return <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><h3 className="font-semibold">{title}</h3><p className="mt-12 text-center text-sm text-zinc-500">Sin mediciones disponibles.</p></article>;
  const values = data.map((item) => item.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = data.map((item, index) => `${20 + (index * 280) / Math.max(data.length - 1, 1)},${100 - ((item.value - min) / range) * 70}`).join(" ");
  return <article className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5"><div className="flex items-start justify-between"><h3 className="font-semibold">{title}</h3><span className="text-sm font-bold" style={{ color }}>{showNumber(data.at(-1)?.value ?? null, ` ${unit}`)}</span></div><svg viewBox="0 0 320 120" role="img" aria-label={`Gráfico de ${title.toLowerCase()}`} className="mt-4 h-32 w-full"><line x1="20" y1="100" x2="300" y2="100" stroke="#3f3f46" strokeWidth="1" /><polyline fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={points} />{data.map((item, index) => { const [x, y] = points.split(" ")[index].split(","); return <circle key={`${item.date}-${index}`} cx={x} cy={y} r="4" fill={color} />; })}</svg><div className="flex justify-between text-xs text-zinc-500"><span>{showDate(data[0].date)}</span><span>{showDate(data.at(-1)?.date ?? data[0].date)}</span></div></article>;
}

function HistoryTable({ items, onView, onEdit, onRemove }: { items: PhysicalEvaluation[]; onView: (item: PhysicalEvaluation) => void; onEdit: (item: PhysicalEvaluation) => void; onRemove: (item: PhysicalEvaluation) => void }) {
  return <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"><div className="border-b border-zinc-800 p-5"><h2 className="font-semibold">Historial completo</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead className="text-zinc-500"><tr><th className="p-4">Fecha</th><th>Peso</th><th>Altura</th><th>IMC</th><th>Grasa</th><th>Músculo</th><th>Observaciones</th><th aria-label="Acciones" /></tr></thead><tbody>{items.length === 0 ? <tr><td colSpan={8} className="p-12 text-center text-zinc-500">No hay evaluaciones registradas.</td></tr> : items.map((item) => <tr key={item.id} className="border-t border-zinc-800"><td className="p-4 font-medium">{showDate(item.date)}</td><td>{showNumber(item.weight, " kg")}</td><td>{showNumber(item.height, " m")}</td><td>{showNumber(item.bmi)}</td><td>{showNumber(item.bodyFatPercentage, "%")}</td><td>{showNumber(item.muscleMass, " kg")}</td><td className="max-w-48 truncate text-zinc-400">{item.notes || "—"}</td><td className="space-x-3 whitespace-nowrap pr-4 text-yellow-400"><button onClick={() => onView(item)}>Ver</button><button onClick={() => onEdit(item)}>Editar</button><button onClick={() => onRemove(item)} className="text-red-300">Eliminar</button></td></tr>)}</tbody></table></div></section>;
}

function EvaluationForm({ form, setForm, students, error, close, submit, editing, saving }: { form: EvaluationDraft; setForm: (form: EvaluationDraft) => void; students: Student[]; error: string; close: () => void; submit: (event: FormEvent) => void; editing: boolean; saving: boolean }) {
  function set<K extends keyof EvaluationDraft>(key: K, value: EvaluationDraft[K]) { setForm({ ...form, [key]: value }); }
  function setNumber(key: NumericEvaluationKey, value: string) { set(key, value === "" ? null : Number(value)); }
  const bmi = form.weight !== null && form.height !== null && form.height > 0 ? Math.round((form.weight / (form.height * form.height)) * 10) / 10 : null;
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4"><form onSubmit={submit} className="mx-auto my-8 w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-white"><div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold">{editing ? "Editar evaluación" : "Nueva evaluación"}</h2><p className="mt-1 text-sm text-zinc-400">Dejá vacíos los valores que no fueron medidos.</p></div><button type="button" onClick={close} className="self-start text-zinc-400">Cerrar</button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="sm:col-span-2">Alumno<select required value={form.studentId} onChange={(event) => set("studentId", event.target.value)} className={`${inputClass} mt-1`}>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}</select></label><label>Fecha<input required type="date" max={today()} value={form.date} onChange={(event) => set("date", event.target.value)} className={`${inputClass} mt-1`} /></label></div>
    <h3 className="mt-7 font-semibold text-yellow-400">Composición corporal</h3><div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-6"><NumberField label="Peso (kg)" value={form.weight} setValue={(value) => setNumber("weight", value)} min={20} max={500} /><NumberField label="Altura (m)" value={form.height} setValue={(value) => setNumber("height", value)} min={0.8} max={2.5} step="0.01" /><label>IMC calculado<div className={`${inputClass} mt-1 border-yellow-400/40 text-yellow-300`}>{showNumber(bmi)}</div></label><NumberField label="Grasa corporal (%)" value={form.bodyFatPercentage} setValue={(value) => setNumber("bodyFatPercentage", value)} min={1} max={75} /><NumberField label="Masa muscular (kg)" value={form.muscleMass} setValue={(value) => setNumber("muscleMass", value)} min={1} max={250} /><NumberField label="Grasa visceral" value={form.visceralFat} setValue={(value) => setNumber("visceralFat", value)} min={0} max={60} /></div>
    <h3 className="mt-7 font-semibold text-yellow-400">Perímetros (cm)</h3><div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{perimeterFields.map((field) => <NumberField key={field.key} label={field.label} value={form[field.key]} setValue={(value) => setNumber(field.key, value)} min={10} max={300} />)}</div>
    <label className="mt-6 block">Observaciones<textarea maxLength={3000} value={form.notes} onChange={(event) => set("notes", event.target.value)} rows={4} className={`${inputClass} mt-1`} /></label>
    <fieldset className="mt-6 rounded-xl border border-dashed border-yellow-400/30 p-4"><legend className="px-2 font-semibold text-yellow-400">Fotos de progreso</legend><p className="mb-4 text-sm text-zinc-500">Se guardan únicamente URLs. Los campos pueden quedar vacíos hasta configurar almacenamiento de imágenes.</p><div className="grid gap-4 md:grid-cols-3"><UrlField label="Foto frontal" value={form.frontPhotoUrl} setValue={(value) => set("frontPhotoUrl", value)} /><UrlField label="Foto lateral" value={form.sidePhotoUrl} setValue={(value) => set("sidePhotoUrl", value)} /><UrlField label="Foto posterior" value={form.backPhotoUrl} setValue={(value) => set("backPhotoUrl", value)} /></div></fieldset>
    <button disabled={saving} className="mt-6 w-full rounded-xl bg-yellow-400 px-5 py-3 font-bold text-zinc-950 transition hover:bg-yellow-300 disabled:opacity-60">{saving ? "Guardando…" : "Guardar evaluación"}</button>
  </form></div>;
}

function NumberField({ label, value, setValue, min, max, step = "0.1" }: { label: string; value: number | null; setValue: (value: string) => void; min: number; max: number; step?: string }) {
  return <label>{label}<input type="number" min={min} max={max} step={step} value={value ?? ""} onChange={(event) => setValue(event.target.value)} className={`${inputClass} mt-1`} /></label>;
}

function UrlField({ label, value, setValue }: { label: string; value: string; setValue: (value: string) => void }) {
  return <label>{label}<input type="url" placeholder="https://…" value={value} onChange={(event) => setValue(event.target.value)} className={`${inputClass} mt-1`} /></label>;
}

function EvaluationDetail({ item, close }: { item: PhysicalEvaluation; close: () => void }) {
  const measurements: Array<[string, number | null, string]> = [["Peso", item.weight, " kg"], ["Altura", item.height, " m"], ["IMC", item.bmi, ""], ["Grasa corporal", item.bodyFatPercentage, "%"], ["Masa muscular", item.muscleMass, " kg"], ["Grasa visceral", item.visceralFat, ""], ...perimeterFields.map((field) => [field.label, item[field.key], " cm"] as [string, number | null, string])];
  const photos = [["Frontal", item.frontPhotoUrl], ["Lateral", item.sidePhotoUrl], ["Posterior", item.backPhotoUrl]].filter((photo) => photo[1]);
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4"><section className="mx-auto my-8 w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-white"><div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold">Evaluación de {item.studentName}</h2><p className="mt-1 text-sm text-zinc-400">{showDate(item.date)}</p></div><button onClick={close} className="self-start text-zinc-400">Cerrar</button></div><dl className="mt-6 grid gap-4 sm:grid-cols-3">{measurements.map(([label, value, suffix]) => <div key={label} className="rounded-xl bg-zinc-950 p-3"><dt className="text-xs text-zinc-500">{label}</dt><dd className="mt-1 font-semibold">{showNumber(value, suffix)}</dd></div>)}</dl><div className="mt-6"><h3 className="font-semibold text-yellow-400">Observaciones</h3><p className="mt-2 rounded-xl border border-zinc-800 p-4 text-sm text-zinc-300">{item.notes || "Sin observaciones."}</p></div><div className="mt-6"><h3 className="font-semibold text-yellow-400">Fotos de progreso</h3>{photos.length ? <div className="mt-3 flex flex-wrap gap-3">{photos.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-yellow-300">Abrir foto {label.toLowerCase()}</a>)}</div> : <p className="mt-2 text-sm text-zinc-500">No hay URLs de fotos cargadas.</p>}</div></section></div>;
}
