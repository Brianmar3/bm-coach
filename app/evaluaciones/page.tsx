"use client";

import { FormEvent, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import type { PhysicalEvaluation, Student } from "@/types/gestion";

type EvaluationDraft = Omit<PhysicalEvaluation, "id" | "studentName" | "bmi" | "createdAt">;
type NumericEvaluationKey = keyof Pick<EvaluationDraft,
  "weight" | "height" | "bodyFatPercentage" | "muscleMass" | "visceralFat" |
  "waist" | "hip" | "chest" | "rightArm" | "leftArm" | "rightThigh" |
  "leftThigh" | "rightCalf" | "leftCalf"
>;

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
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
  const [studentQuery, setStudentQuery] = useState("");
  const [form, setForm] = useState<EvaluationDraft>(blankEvaluation());
  const [editing, setEditing] = useState<PhysicalEvaluation | null>(null);
  const [viewing, setViewing] = useState<PhysicalEvaluation | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
      const requestedStudentId = new URLSearchParams(window.location.search).get("studentId") ?? "";
      const requestedStudent = realStudents.find((student) => student.id === requestedStudentId);
      setSelectedStudentId(requestedStudent?.id ?? "");
      setStudentQuery(requestedStudent ? `${requestedStudent.firstName} ${requestedStudent.lastName}`.trim() : "");
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

  function selectStudent(studentId: string) {
    setSelectedStudentId(studentId);
    const student = students.find((item) => item.id === studentId);
    setStudentQuery(student ? `${student.firstName} ${student.lastName}`.trim() : "");
    const url = new URL(window.location.href);
    if (studentId) url.searchParams.set("studentId", studentId);
    else url.searchParams.delete("studentId");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

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
    setNotice("");
    setOpen(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
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
      setNotice(editing ? "Evaluación actualizada correctamente." : "Evaluación registrada correctamente.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la evaluación en Neon.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: PhysicalEvaluation) {
    if (deletingId || !window.confirm(`Vas a eliminar la evaluación del ${showDate(item.date)} de ${item.studentName}. Esta acción no se puede deshacer.`)) return;
    setDeletingId(item.id);
    setError("");
    try {
      const response = await fetch(`/api/evaluaciones/${item.id}?studentId=${encodeURIComponent(item.studentId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo eliminar la evaluación."));
      setItems((current) => current.filter((evaluation) => evaluation.id !== item.id));
      if (viewing?.id === item.id) setViewing(null);
      setNotice("Evaluación eliminada correctamente.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la evaluación de Neon.");
    } finally {
      setDeletingId("");
    }
  }

  return <ModuleShell title="Evaluaciones físicas" subtitle="Seguimiento corporal e historial por alumno." action={<button onClick={() => begin()} className="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-zinc-950 transition hover:bg-yellow-300">+ Nueva evaluación</button>}>
    {(error || notice) && !open && <p role={error ? "alert" : "status"} className={`mb-4 rounded-xl border p-3 text-sm ${error ? "border-red-400/30 bg-red-400/10 text-red-200" : "border-emerald-400/30 bg-emerald-400/10 text-emerald-200"}`}>{error || notice}</p>}

    <section className="mb-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
      <StudentSearch students={students} evaluations={items} selectedStudentId={selectedStudentId} query={studentQuery} setQuery={setStudentQuery} select={selectStudent} />
    </section>

    {!ready ? <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Array.from({ length: 12 }, (_, index) => <div key={index} className="h-20 animate-pulse rounded-xl bg-zinc-900" />)}</section> : !selectedStudent ? <section className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900 p-8 text-center text-sm text-zinc-500">Buscá y seleccioná un alumno para ver sus evaluaciones.</section> : <>
      <EvaluationSummary latest={latest} previous={previous} />
      <ComparisonSection latest={latest} previous={previous} />
      <SymmetrySection latest={latest} />
      <HistoryList items={history} deletingId={deletingId} onView={setViewing} onEdit={begin} onRemove={remove} />
    </>}

    {open && <EvaluationForm form={form} setForm={setForm} students={students} error={error} close={() => setOpen(false)} submit={submit} editing={Boolean(editing)} saving={saving} />}
    {viewing && <EvaluationDetail item={viewing} close={() => setViewing(null)} />}
  </ModuleShell>;
}

function normalizedSearch(value: string) {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/\s+/g, " ").trim().toLocaleLowerCase("es");
}

function StudentSearch({ students, evaluations, selectedStudentId, query, setQuery, select }: {
  students: Student[];
  evaluations: PhysicalEvaluation[];
  selectedStudentId: string;
  query: string;
  setQuery: (value: string) => void;
  select: (studentId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const selected = students.find((student) => student.id === selectedStudentId);
  const results = useMemo(() => {
    const normalized = normalizedSearch(query);
    return students
      .filter((student) => !normalized || normalizedSearch(`${student.firstName} ${student.lastName} ${student.phone}`).includes(normalized))
      .sort((left, right) => `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`, "es"))
      .slice(0, 10);
  }, [query, students]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  function choose(student: Student) {
    select(student.id);
    setOpen(false);
    setActiveIndex(0);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && open && results[activeIndex]) {
      event.preventDefault();
      choose(results[activeIndex]);
    }
  }

  return <div ref={containerRef} className="relative">
    <label htmlFor="evaluation-student-search" className="text-xs text-zinc-400">Alumno</label>
    <div className="relative mt-1">
      <input
        id="evaluation-student-search"
        type="search"
        role="combobox"
        aria-label="Buscar alumno por nombre, apellido o teléfono"
        aria-expanded={open}
        aria-controls="evaluation-student-results"
        aria-activedescendant={open && results[activeIndex] ? `evaluation-student-${results[activeIndex].id}` : undefined}
        autoComplete="off"
        value={query}
        onFocus={() => { setOpen(true); setActiveIndex(0); }}
        onChange={(event) => {
          if (selectedStudentId) select("");
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(0);
        }}
        onKeyDown={onKeyDown}
        placeholder="Buscar alumno por nombre, apellido o teléfono"
        className={`${inputClass} py-3 pr-11 focus:border-yellow-400`}
      />
      {(query || selectedStudentId) && <button type="button" onClick={() => { select(""); setOpen(false); }} aria-label="Limpiar alumno seleccionado" className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-yellow-400">×</button>}
    </div>
    {open && <div id="evaluation-student-results" role="listbox" className="absolute z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-950 p-1.5 shadow-2xl">
      {results.length === 0 ? <p className="p-4 text-center text-sm text-zinc-500">No se encontraron alumnos</p> : results.map((student, index) => {
        const studentEvaluations = evaluations.filter((evaluation) => evaluation.studentId === student.id).sort((left, right) => `${right.date}${right.createdAt}`.localeCompare(`${left.date}${left.createdAt}`));
        const last = studentEvaluations[0];
        return <button
          type="button"
          role="option"
          aria-selected={student.id === selectedStudentId}
          id={`evaluation-student-${student.id}`}
          key={student.id}
          onMouseEnter={() => setActiveIndex(index)}
          onClick={() => choose(student)}
          className={`block min-h-14 w-full rounded-lg px-3 py-2 text-left focus:outline-none focus:ring-2 focus:ring-yellow-400 ${activeIndex === index ? "bg-zinc-800" : "hover:bg-zinc-900"}`}
        >
          <span className="block font-semibold text-white">{student.firstName} {student.lastName}</span>
          <span className="mt-0.5 block text-xs text-zinc-500">{student.phone ? `${student.phone} · ` : ""}{studentEvaluations.length} evaluación{studentEvaluations.length === 1 ? "" : "es"}{last ? ` · Última: ${showDate(last.date)}` : ""}</span>
        </button>;
      })}
    </div>}
    {selected && !open && <div className="mt-2 flex items-center justify-between rounded-lg bg-zinc-950 px-3 py-2"><div><p className="text-sm font-bold text-white">{selected.firstName} {selected.lastName}</p><p className="text-xs text-zinc-500">{selected.phone || "Sin teléfono"} · {evaluations.filter((evaluation) => evaluation.studentId === selected.id).length} evaluaciones</p></div><button type="button" onClick={() => select("")} className="rounded-lg px-3 py-2 text-xs font-bold text-zinc-400 hover:bg-zinc-800">Limpiar</button></div>}
  </div>;
}

function EvaluationSummary({ latest, previous }: { latest: PhysicalEvaluation | null; previous: PhysicalEvaluation | null }) {
  if (!latest) return <section className="rounded-2xl border border-dashed border-zinc-700 bg-zinc-900 p-8 text-center"><h2 className="font-semibold text-white">No hay evaluaciones registradas para este alumno.</h2><p className="mt-2 text-sm text-zinc-500">Usá “+ Nueva evaluación” para registrar la primera medición.</p></section>;
  const metrics: Array<[string, number | null, string]> = [
    ["Peso", latest.weight, " kg"], ["Altura", latest.height, " m"], ["IMC", latest.bmi, ""],
    ["Grasa corporal", latest.bodyFatPercentage, " %"], ["Masa muscular", latest.muscleMass, " kg"],
    ["Grasa visceral", latest.visceralFat, ""], ["Cintura", latest.waist, " cm"], ["Cadera", latest.hip, " cm"],
    ["Pecho", latest.chest, " cm"], ["Brazo derecho", latest.rightArm, " cm"], ["Brazo izquierdo", latest.leftArm, " cm"],
    ["Muslo derecho", latest.rightThigh, " cm"], ["Muslo izquierdo", latest.leftThigh, " cm"],
    ["Pantorrilla derecha", latest.rightCalf, " cm"], ["Pantorrilla izquierda", latest.leftCalf, " cm"],
  ];
  const waistHipRatio = latest.waist !== null && latest.hip !== null && latest.hip > 0 ? latest.waist / latest.hip : null;
  return <section><div className="mb-2 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-yellow-400">Última evaluación</p><h2 className="text-sm font-semibold">{showDate(latest.date)}</h2></div>{previous && <span className="text-xs text-zinc-500">Anterior: {showDate(previous.date)}</span>}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{metrics.map(([title, value, suffix]) => <Metric key={title} label={title} value={showNumber(value, suffix)} />)}{waistHipRatio !== null && <Metric label="Relación cintura/cadera" value={showNumber(waistHipRatio)} />}</div></section>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-3"><p className="text-[11px] text-zinc-500">{label}</p><p className="mt-1 text-base font-bold text-white">{value}</p></div>;
}

function ComparisonSection({ latest, previous }: { latest: PhysicalEvaluation | null; previous: PhysicalEvaluation | null }) {
  if (!latest) return null;
  const fields: Array<[string, keyof PhysicalEvaluation, string]> = [
    ["Peso", "weight", " kg"], ["Grasa corporal", "bodyFatPercentage", " puntos"],
    ["Masa muscular", "muscleMass", " kg"], ["Cintura", "waist", " cm"], ["Cadera", "hip", " cm"],
  ];
  return <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3"><h2 className="font-bold text-yellow-300">Comparación anterior</h2>{!previous ? <p className="mt-2 text-sm text-zinc-500">Todavía no hay datos suficientes para comparar.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{fields.map(([title, key, suffix]) => {
    const current = latest[key] as number | null;
    const before = previous[key] as number | null;
    const delta = difference(current, before);
    if (current === null || before === null) return null;
    return <article key={title} className="rounded-lg bg-zinc-950 p-3"><p className="text-xs text-zinc-500">{title}</p><p className="mt-1 text-sm font-semibold">{showNumber(before, suffix)} <span className="text-zinc-600">→</span> {showNumber(current, suffix)}</p><p className="mt-1 text-xs text-yellow-200">{delta === 0 ? "Sin cambios" : `${delta !== null && delta > 0 ? "↑ +" : "↓ "}${showNumber(delta, suffix)}`}</p></article>;
  })}</div>}</section>;
}

function SymmetrySection({ latest }: { latest: PhysicalEvaluation | null }) {
  if (!latest) return null;
  const pairs: Array<[string, number | null, number | null]> = [
    ["Brazos", latest.rightArm, latest.leftArm], ["Muslos", latest.rightThigh, latest.leftThigh], ["Pantorrillas", latest.rightCalf, latest.leftCalf],
  ];
  const available = pairs.filter(([, right, left]) => right !== null && left !== null);
  if (!available.length) return null;
  return <section className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900 p-3"><h2 className="font-bold text-yellow-300">Simetría corporal</h2><p className="mt-1 text-xs text-zinc-500">Comparación descriptiva, sin interpretación médica.</p><div className="mt-3 grid gap-2 sm:grid-cols-3">{available.map(([title, right, left]) => {
    const delta = Math.abs((right ?? 0) - (left ?? 0));
    const larger = right === left ? "Iguales" : (right ?? 0) > (left ?? 0) ? "Mayor: derecho" : "Mayor: izquierdo";
    const percent = Math.max(right ?? 0, left ?? 0) > 0 ? delta / Math.max(right ?? 0, left ?? 0) * 100 : null;
    return <article key={title} className="rounded-lg bg-zinc-950 p-3"><p className="font-semibold">{title}</p><p className="mt-1 text-xs text-zinc-400">Derecho: {showNumber(right, " cm")} · Izquierdo: {showNumber(left, " cm")}</p><p className="mt-2 text-xs text-yellow-200">Diferencia: {showNumber(delta, " cm")}{percent !== null ? ` · ${showNumber(percent, "%")}` : ""}</p><p className="mt-1 text-[11px] text-zinc-500">{larger}</p></article>;
  })}</div></section>;
}

function HistoryList({ items, deletingId, onView, onEdit, onRemove }: { items: PhysicalEvaluation[]; deletingId: string; onView: (item: PhysicalEvaluation) => void; onEdit: (item: PhysicalEvaluation) => void; onRemove: (item: PhysicalEvaluation) => void }) {
  return <section className="mt-4 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"><div className="border-b border-zinc-800 px-4 py-3"><h2 className="font-semibold">Historial de evaluaciones</h2></div>{items.length === 0 ? <p className="p-8 text-center text-sm text-zinc-500">No hay evaluaciones registradas.</p> : <div>{items.map((item) => <article key={item.id} className="flex items-center gap-3 border-b border-zinc-800 p-3 last:border-0"><button onClick={() => onView(item)} className="min-w-0 flex-1 text-left"><p className="font-semibold">{showDate(item.date)}</p><p className="mt-1 truncate text-xs text-zinc-400">{showNumber(item.weight, " kg")} · Grasa {showNumber(item.bodyFatPercentage, "%")} · Músculo {showNumber(item.muscleMass, " kg")} · Cintura {showNumber(item.waist, " cm")}</p></button><button onClick={() => onView(item)} className="shrink-0 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-bold text-yellow-300">Ver detalle</button><details className="relative"><summary className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-lg bg-zinc-800 text-lg">⋮</summary><div className="absolute right-0 z-10 mt-1 w-44 rounded-lg border border-zinc-700 bg-zinc-950 p-1 shadow-xl"><button onClick={() => onView(item)} className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-zinc-800">Ver detalle</button><button onClick={() => onEdit(item)} className="block w-full rounded px-3 py-2 text-left text-xs hover:bg-zinc-800">Editar evaluación</button><button onClick={() => onRemove(item)} disabled={deletingId === item.id} className="block w-full rounded px-3 py-2 text-left text-xs text-red-300 hover:bg-zinc-800 disabled:opacity-50">{deletingId === item.id ? "Eliminando…" : "Eliminar evaluación"}</button></div></details></article>)}</div>}</section>;
}

function EvaluationForm({ form, setForm, students, error, close, submit, editing, saving }: { form: EvaluationDraft; setForm: (form: EvaluationDraft) => void; students: Student[]; error: string; close: () => void; submit: (event: FormEvent) => void; editing: boolean; saving: boolean }) {
  function set<K extends keyof EvaluationDraft>(key: K, value: EvaluationDraft[K]) { setForm({ ...form, [key]: value }); }
  function setNumber(key: NumericEvaluationKey, value: string) { set(key, value === "" ? null : Number(value.replace(",", "."))); }
  const bmi = form.weight !== null && form.height !== null && form.height > 0 ? Math.round((form.weight / (form.height * form.height)) * 10) / 10 : null;
  return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4"><form onSubmit={submit} className="mx-auto my-8 w-full max-w-5xl rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-white"><div className="flex justify-between gap-4"><div><h2 className="text-xl font-bold">{editing ? "Editar evaluación" : "Nueva evaluación"}</h2><p className="mt-1 text-sm text-zinc-400">Dejá vacíos los valores que no fueron medidos.</p></div><button type="button" onClick={close} className="self-start text-zinc-400">Cerrar</button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}
    <div className="mt-5 grid gap-4 sm:grid-cols-3"><label className="sm:col-span-2">Alumno<select required disabled={editing} value={form.studentId} onChange={(event) => set("studentId", event.target.value)} className={`${inputClass} mt-1 disabled:opacity-60`}>{students.map((student) => <option key={student.id} value={student.id}>{student.firstName} {student.lastName}</option>)}</select></label><label>Fecha<input required type="date" max={today()} value={form.date} onChange={(event) => set("date", event.target.value)} className={`${inputClass} mt-1`} /></label></div>
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
