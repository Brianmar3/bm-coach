"use client";

import { useState } from "react";
import { BmBackIcon, BmCheckIcon, BmRoutineIcon, BmTargetIcon, BmTimerIcon } from "@/componentes/icons";
import { EQUIPMENT_OPTIONS, SELF_SERVICE_GOALS, TRAINING_LOCATIONS } from "@/lib/self-service";
import type { SelfServiceRoutineAnswers, SelfServiceRoutineProposal } from "@/lib/self-service-routine-proposal";
import { selfServiceProposalError } from "@/lib/self-service-routine-persistence";

type Props = { initial: SelfServiceRoutineAnswers };
const levels = ["Principiante", "Intermedio", "Avanzado"] as const;
const priorities = ["", "Piernas", "Glúteos", "Espalda", "Pecho", "Hombros", "Brazos", "Core"];
const stepTitles = ["Confirmá tu objetivo", "Confirmá tu nivel", "Días por semana", "Duración por sesión", "Lugar y equipamiento", "Prioridad muscular", "Tu rutina sugerida"];
const optionClass = (active: boolean) => `min-h-12 rounded-xl border px-3 py-2 text-left text-sm font-semibold transition ${active ? "border-yellow-300 bg-yellow-400/[.09] text-yellow-200" : "border-white/10 bg-black/25 text-zinc-300 hover:border-yellow-400/30"}`;

export function SelfServiceRoutineWizard({ initial }: Props) {
  const [step, setStep] = useState(0);
  const [editing, setEditing] = useState(false);
  const [answers, setAnswers] = useState(initial);
  const [proposal, setProposal] = useState<SelfServiceRoutineProposal | null>(null);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState("");
  const update = <K extends keyof SelfServiceRoutineAnswers>(key: K, value: SelfServiceRoutineAnswers[K]) => setAnswers((current) => ({ ...current, [key]: value }));
  const toggleEquipment = (item: string) => update("equipment", answers.equipment.includes(item) ? answers.equipment.filter((value) => value !== item) : [...answers.equipment, item]);
  const canContinue = step !== 4 || answers.equipment.length > 0;

  async function generate(variation = answers.variation ?? 0) {
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/portal/autogestion/rutina/propuesta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...answers, variation }) });
      const body = await response.json() as SelfServiceRoutineProposal & { error?: string };
      if (!response.ok) throw new Error(body.error || "No pudimos generar la propuesta.");
      setAnswers((current) => ({ ...current, variation })); setProposal(body); setStep(6);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos generar la propuesta."); }
    finally { setLoading(false); }
  }

  function next() { if (step === 5) void generate(); else setStep((current) => Math.min(6, current + 1)); }

  async function activate() {
    if (!proposal || activating) return;
    setActivating(true); setError("");
    try {
      const response = await fetch("/api/portal/autogestion/rutina", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers, proposal }) });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(body.error || "No pudimos guardar tu rutina.");
      window.location.replace("/portal/autogestion/rutina");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos guardar tu rutina."); setActivating(false); }
  }

  async function changeExercise(dayIndex: number, exerciseIndex: number) {
    if (!proposal || loading || activating) return;
    const variation = (answers.variation ?? 0) + 1;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/portal/autogestion/rutina/propuesta", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...answers, variation }) });
      const replacement = await response.json() as SelfServiceRoutineProposal & { error?: string };
      if (!response.ok) throw new Error(replacement.error || "No pudimos cambiar el ejercicio.");
      const currentIds = new Set(proposal.days.flatMap((day) => day.exercises.map((exercise) => exercise.libraryId)));
      const candidate = replacement.days.flatMap((day) => day.exercises).find((exercise) => !currentIds.has(exercise.libraryId)) ?? replacement.days[dayIndex]?.exercises[exerciseIndex];
      if (!candidate) throw new Error("No encontramos otra opción compatible.");
      setProposal({ ...proposal, days: proposal.days.map((day, currentDay) => currentDay !== dayIndex ? day : { ...day, exercises: day.exercises.map((exercise, currentExercise) => currentExercise === exerciseIndex ? candidate : exercise) }) });
      setAnswers((current) => ({ ...current, variation }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos cambiar el ejercicio."); }
    finally { setLoading(false); }
  }

  const showingSummary = !editing && !proposal;
  return <div className="mx-auto max-w-3xl">
    <header className="mb-4"><p className="text-[10px] font-black uppercase tracking-[.2em] text-yellow-400">Crear mi rutina</p><div className="mt-2 flex items-center justify-between gap-3"><h1 className="text-2xl font-black sm:text-3xl">{showingSummary ? "Vamos a crear tu rutina con estos datos" : stepTitles[step]}</h1>{!showingSummary && <span className="shrink-0 text-xs text-zinc-500">{step + 1} de 7</span>}</div>{!showingSummary && <div className="mt-3 grid grid-cols-7 gap-1">{stepTitles.map((title, index) => <span key={title} className={`h-1 rounded-full ${index <= step ? "bg-yellow-400" : "bg-zinc-800"}`} />)}</div>}</header>
    <section className="rounded-[22px] border border-yellow-400/25 bg-[linear-gradient(145deg,#151515,#090909)] p-4 shadow-[0_16px_36px_rgba(0,0,0,.3)] sm:p-6">
      {showingSummary && <SetupSummary answers={answers} loading={loading} generate={() => void generate()} edit={() => setEditing(true)} />}
      {editing && step === 0 && <OptionGrid values={SELF_SERVICE_GOALS} selected={answers.objective} choose={(value) => update("objective", value)} />}
      {editing && step === 1 && <OptionGrid values={levels} selected={answers.level} choose={(value) => update("level", value)} />}
      {editing && step === 2 && <div className="grid grid-cols-5 gap-2">{[1,2,3,4,5].map((value) => <button type="button" key={value} onClick={() => update("daysPerWeek", value)} className={optionClass(answers.daysPerWeek === value)}><span className="block text-center text-lg font-black">{value}</span></button>)}</div>}
      {editing && step === 3 && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[30,45,60,75].map((value) => <button type="button" key={value} onClick={() => update("sessionMinutes", value)} className={optionClass(answers.sessionMinutes === value)}><BmTimerIcon size={18} className="mb-1 text-yellow-400" />{value} min</button>)}</div>}
      {editing && step === 4 && <div className="space-y-5"><div><h2 className="mb-2 text-xs font-black uppercase tracking-wider text-yellow-400">Lugar</h2><OptionGrid values={TRAINING_LOCATIONS} selected={answers.trainingLocation} choose={(value) => update("trainingLocation", value)} /></div><div><h2 className="mb-2 text-xs font-black uppercase tracking-wider text-yellow-400">Equipamiento disponible</h2><div className="grid grid-cols-2 gap-2">{EQUIPMENT_OPTIONS.map((item) => <button type="button" key={item} onClick={() => toggleEquipment(item)} className={optionClass(answers.equipment.includes(item))}>{item}</button>)}</div></div></div>}
      {editing && step === 5 && <div><p className="mb-3 text-sm text-zinc-400">Es opcional. Si no elegís una, la estructura será equilibrada.</p><OptionGrid values={priorities} selected={answers.priorityMuscle} choose={(value) => update("priorityMuscle", value)} labels={{ "": "Sin prioridad específica" }} /></div>}
      {proposal && <Proposal proposal={proposal} loading={loading} activating={activating} change={setProposal} changeExercise={(dayIndex, exerciseIndex) => void changeExercise(dayIndex, exerciseIndex)} activate={() => void activate()} regenerate={() => void generate((answers.variation ?? 0) + 1)} />}
      {error && <p role="alert" className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}
      {editing && step < 6 && <div className="mt-6 flex gap-2"><button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={step === 0 || loading} className="grid min-h-12 min-w-12 place-items-center rounded-xl border border-white/10 text-zinc-300 disabled:opacity-30" aria-label="Paso anterior"><BmBackIcon size={20} /></button><button type="button" onClick={next} disabled={!canContinue || loading} className="min-h-12 flex-1 rounded-xl bg-yellow-400 px-4 font-black text-black disabled:opacity-50">{loading ? "Generando…" : step === 5 ? "Generar propuesta" : "Confirmar y continuar"}</button></div>}
    </section>
  </div>;
}

function SetupSummary({ answers, loading, generate, edit }: { answers: SelfServiceRoutineAnswers; loading: boolean; generate: () => void; edit: () => void }) {
  const rows = [
    ["Objetivo", answers.objective], ["Nivel", answers.level], ["Frecuencia", `${answers.daysPerWeek} ${answers.daysPerWeek === 1 ? "día" : "días"} por semana`],
    ["Duración", `${answers.sessionMinutes} minutos`], ["Lugar", answers.trainingLocation], ["Equipamiento", answers.equipment.join(", ")],
  ];
  return <div><div className="grid gap-2 sm:grid-cols-2">{rows.map(([label, value]) => <div key={label} className="rounded-xl border border-white/[.08] bg-black/25 p-3"><span className="block text-[10px] font-black uppercase tracking-wider text-yellow-400">{label}</span><strong className="mt-1 block text-sm text-zinc-100">{value}</strong></div>)}</div>{answers.limitations?.trim() && <p className="mt-3 rounded-xl border border-yellow-400/20 bg-yellow-400/[.06] p-3 text-xs leading-5 text-zinc-300">Registramos tus molestias o limitaciones. La propuesta no reemplaza una indicación profesional y vas a poder revisar cada ejercicio antes de activarla.</p>}<button type="button" onClick={generate} disabled={loading} className="mt-5 min-h-12 w-full rounded-xl bg-yellow-400 px-4 font-black text-black disabled:opacity-50">{loading ? "Generando…" : "Generar mi rutina"}</button><button type="button" onClick={edit} disabled={loading} className="mt-2 min-h-11 w-full text-sm font-bold text-zinc-400 disabled:opacity-50">Editar datos</button></div>;
}

function OptionGrid<T extends string>({ values, selected, choose, labels = {} }: { values: readonly T[]; selected: string; choose: (value: T) => void; labels?: Record<string, string> }) {
  return <div className="grid gap-2 sm:grid-cols-2">{values.map((value) => <button type="button" key={value || "empty"} onClick={() => choose(value)} className={optionClass(selected === value)}><span className="flex items-center justify-between gap-2">{labels[value] ?? value}{selected === value && <BmCheckIcon size={17} className="shrink-0 text-yellow-300" />}</span></button>)}</div>;
}

function Proposal({ proposal, loading, activating, change, changeExercise, activate, regenerate }: { proposal: SelfServiceRoutineProposal; loading: boolean; activating: boolean; change: (proposal: SelfServiceRoutineProposal) => void; changeExercise: (dayIndex: number, exerciseIndex: number) => void; activate: () => void; regenerate: () => void }) {
  const valid = !selfServiceProposalError(proposal);
  const updateExercise = (dayIndex: number, exerciseIndex: number, field: "sets" | "repetitions" | "restSeconds", value: string) => change({ ...proposal, days: proposal.days.map((day, currentDay) => currentDay !== dayIndex ? day : { ...day, exercises: day.exercises.map((exercise, currentExercise) => currentExercise !== exerciseIndex ? exercise : { ...exercise, [field]: field === "repetitions" ? value : value === "" ? 0 : Number(value) }) }) });
  return <div><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-full border border-yellow-400/30 text-yellow-300"><BmTargetIcon size={22} /></span><div><h2 className="text-xl font-black">{proposal.title}</h2><p className="mt-1 text-sm text-zinc-400">{proposal.summary}</p></div></div>{proposal.warning && <p className="mt-4 rounded-xl border border-yellow-400/20 bg-yellow-400/[.06] p-3 text-xs leading-5 text-zinc-300">{proposal.warning}</p>}<div className="mt-5 space-y-3">{proposal.days.map((day, dayIndex) => <details key={day.dayNumber} open={day.dayNumber === 1} className="rounded-2xl border border-white/10 bg-black/25 p-3"><summary className="cursor-pointer list-none"><span className="flex items-center justify-between gap-3"><span><strong className="block">Día {day.dayNumber} · {day.name}</strong><small className="text-zinc-500">{day.exercises.length} ejercicios</small></span><BmRoutineIcon size={20} className="text-yellow-400" /></span></summary><ol className="mt-3 divide-y divide-white/[.07]">{day.exercises.map((exercise, exerciseIndex) => <li key={exercise.libraryId} className="py-3 text-sm"><span className="flex items-start justify-between gap-2"><span className="min-w-0"><strong className="block text-zinc-200">{exercise.name}</strong><small className="text-zinc-500">{exercise.muscleGroup} · {exercise.equipment}</small></span><button type="button" onClick={() => changeExercise(dayIndex, exerciseIndex)} disabled={loading || activating} className="shrink-0 rounded-lg border border-yellow-400/25 px-2 py-1 text-[10px] font-bold text-yellow-300 disabled:opacity-40">Cambiar ejercicio</button></span><div className="mt-2 grid grid-cols-3 gap-2"><EditField label="Series" value={String(exercise.sets)} type="number" min={1} max={10} update={(value) => updateExercise(dayIndex, exerciseIndex, "sets", value)} /><EditField label="Reps" value={exercise.repetitions} update={(value) => updateExercise(dayIndex, exerciseIndex, "repetitions", value)} /><EditField label="Descanso (s)" value={String(exercise.restSeconds)} type="number" min={0} max={600} update={(value) => updateExercise(dayIndex, exerciseIndex, "restSeconds", value)} /></div></li>)}</ol></details>)}</div>{!valid && <p className="mt-3 text-xs text-red-300">Revisá series, repeticiones y descansos antes de guardar.</p>}<button type="button" onClick={activate} disabled={!valid || activating || loading} className="mt-5 min-h-12 w-full rounded-xl bg-yellow-400 px-4 font-black text-black disabled:cursor-not-allowed disabled:opacity-50">{activating ? "Guardando…" : "Usar esta rutina"}</button><button type="button" onClick={regenerate} disabled={loading || activating} className="mt-2 min-h-11 w-full text-sm font-bold text-zinc-400 disabled:opacity-50">{loading ? "Generando…" : "Volver a generar"}</button></div>;
}

function EditField({ label, value, update, type = "text", min, max }: { label: string; value: string; update: (value: string) => void; type?: "text" | "number"; min?: number; max?: number }) {
  return <label className="min-w-0 text-[10px] font-semibold text-zinc-500">{label}<input aria-label={label} type={type} inputMode={type === "number" ? "numeric" : "text"} min={min} max={max} value={value} onChange={(event) => update(event.target.value)} className="mt-1 min-h-10 w-full min-w-0 rounded-lg border border-zinc-700 bg-black px-2 text-center text-xs text-white outline-none focus:border-yellow-400" /></label>;
}
