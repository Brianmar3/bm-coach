"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { StudentAccessControls } from "@/componentes/student-access-controls";
import type { Student, StudentStatus } from "@/types/gestion";

const blank = (): Omit<Student, "id"> => ({ firstName: "", lastName: "", phone: "", email: "", birthDate: "", weight: 0, height: 0, goal: "", plan: "Plan mensual", monthlyFee: 0, joinedAt: new Date().toISOString().slice(0, 10), dueDate: "", status: "activo", notes: "" });
const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
const age = (birthDate: string) => { if (!birthDate) return "—"; const now = new Date(); const birth = new Date(`${birthDate}T12:00:00`); return now.getFullYear() - birth.getFullYear() - Number(now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())); };
const bmi = (weight: number, height: number) => weight > 0 && height > 0 ? (weight / (height * height)).toFixed(1) : "—";

async function responseError(response: Response, fallback: string) {
  try { return (await response.json() as { error?: string }).error ?? fallback; } catch { return fallback; }
}

export default function AlumnosPage() {
  const [items, setItems] = useState<Student[]>([]); const [ready, setReady] = useState(false); const [query, setQuery] = useState(""); const [status, setStatus] = useState("todos"); const [plan, setPlan] = useState("todos"); const [open, setOpen] = useState(false); const [editing, setEditing] = useState<Student | null>(null); const [viewing, setViewing] = useState<Student | null>(null); const [form, setForm] = useState<Omit<Student, "id">>(blank()); const [error, setError] = useState(""); const [saving, setSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/alumnos", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(await responseError(response, "No se pudieron cargar los alumnos.")); return response.json() as Promise<Student[]>; })
      .then(setItems)
      .catch((loadError: Error) => { if (loadError.name !== "AbortError") setError(loadError.message); })
      .finally(() => setReady(true));
    return () => controller.abort();
  }, []);

  const plans = useMemo(() => [...new Set(items.map((item) => item.plan))], [items]);
  const visible = items.filter((item) => `${item.firstName} ${item.lastName} ${item.phone}`.toLowerCase().includes(query.toLowerCase()) && (status === "todos" || item.status === status) && (plan === "todos" || item.plan === plan));

  function begin(item?: Student) { setEditing(item ?? null); setForm(item ? { firstName: item.firstName, lastName: item.lastName, phone: item.phone, email: item.email, birthDate: item.birthDate, weight: item.weight, height: item.height, goal: item.goal, plan: item.plan, monthlyFee: item.monthlyFee, joinedAt: item.joinedAt, dueDate: item.dueDate, status: item.status, notes: item.notes } : blank()); setError(""); setOpen(true); }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim() || !form.phone.trim() || !form.plan.trim() || form.monthlyFee < 0 || !form.joinedAt || !form.dueDate) { setError("Completá nombre, apellido, teléfono, plan, fechas e importe mensual."); return; }
    setSaving(true); setError("");
    try {
      const response = await fetch(editing ? `/api/alumnos/${editing.id}` : "/api/alumnos", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo guardar el alumno."));
      const saved = await response.json() as Student;
      setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
      setViewing((current) => current?.id === saved.id ? saved : current); setOpen(false);
    } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el alumno."); }
    finally { setSaving(false); }
  }

  async function remove(item: Student) {
    if (!window.confirm(`¿Eliminar a ${item.firstName} ${item.lastName}?`)) return;
    setError("");
    try {
      const response = await fetch(`/api/alumnos/${item.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error(await responseError(response, "No se pudo eliminar el alumno."));
      setItems((current) => current.filter((student) => student.id !== item.id));
      if (viewing?.id === item.id) setViewing(null);
    } catch (deleteError) { setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el alumno."); }
  }

  return <ModuleShell title="Alumnos" subtitle="Fichas, planes y seguimiento de tu cartera de alumnos." action={<button onClick={() => begin()} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950">+ Nuevo alumno</button>}>
    {error && !open && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900"><div className="grid gap-3 border-b border-zinc-800 p-4 md:grid-cols-3"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, apellido o teléfono" className={inputClass} /><select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="todos">Todos los estados</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select><select value={plan} onChange={(event) => setPlan(event.target.value)} className={inputClass}><option value="todos">Todos los planes</option>{plans.map((item) => <option key={item}>{item}</option>)}</select></div><div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="text-zinc-500"><tr><th className="p-4">Alumno</th><th>Plan</th><th>Contacto</th><th>Vencimiento</th><th>Estado</th><th aria-label="Acciones" /></tr></thead><tbody>{!ready ? <tr><td colSpan={6} className="p-12 text-center text-zinc-500">Cargando alumnos…</td></tr> : visible.length === 0 ? <tr><td colSpan={6} className="p-12 text-center text-zinc-500">Todavía no hay alumnos. Creá la primera ficha para empezar.</td></tr> : visible.map((item) => <tr key={item.id} className="border-t border-zinc-800"><td className="p-4 font-medium">{item.firstName} {item.lastName}<span className="block text-xs font-normal text-zinc-500">IMC {bmi(item.weight, item.height)} · {age(item.birthDate)} años</span></td><td>{item.plan}<span className="block text-xs text-zinc-500">{money(item.monthlyFee)}</span></td><td>{item.phone}<span className="block text-xs text-zinc-500">{item.email || "Sin correo"}</span></td><td>{new Date(`${item.dueDate}T12:00:00`).toLocaleDateString("es-AR")}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold capitalize ${item.status === "activo" ? "bg-emerald-400/15 text-emerald-300" : "bg-zinc-700 text-zinc-300"}`}>{item.status}</span></td><td className="space-x-3 whitespace-nowrap pr-4 text-yellow-400"><button onClick={() => setViewing(item)}>Ver ficha</button><button onClick={() => begin(item)}>Editar</button><button onClick={() => remove(item)} className="text-red-300">Eliminar</button></td></tr>)}</tbody></table></div></section>
    {open && <StudentForm form={form} setForm={setForm} error={error} close={() => setOpen(false)} submit={submit} editing={Boolean(editing)} saving={saving} />}{viewing && <StudentDetail item={viewing} close={() => setViewing(null)} />}
  </ModuleShell>;
}

function StudentForm({ form, setForm, error, close, submit, editing, saving }: { form: Omit<Student, "id">; setForm: (form: Omit<Student, "id">) => void; error: string; close: () => void; submit: (event: FormEvent) => void; editing: boolean; saving: boolean }) { function set<K extends keyof Omit<Student, "id">>(key: K, value: Omit<Student, "id">[K]) { setForm({ ...form, [key]: value }); } return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4"><form onSubmit={submit} className="mx-auto my-8 max-w-4xl rounded-2xl bg-zinc-900 p-6 text-white"><div className="flex justify-between"><h2 className="text-xl font-bold">{editing ? "Editar alumno" : "Nuevo alumno"}</h2><button type="button" onClick={close} className="text-zinc-400">Cerrar</button></div>{error && <p role="alert" className="mt-4 rounded-lg bg-red-400/10 p-3 text-sm text-red-300">{error}</p>}<div className="mt-5 grid gap-4 md:grid-cols-3"><label>Nombre<input required value={form.firstName} onChange={(event) => set("firstName", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Apellido<input required value={form.lastName} onChange={(event) => set("lastName", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Teléfono<input required value={form.phone} onChange={(event) => set("phone", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Correo<input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Fecha de nacimiento<input type="date" value={form.birthDate} onChange={(event) => set("birthDate", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Objetivo<input value={form.goal} onChange={(event) => set("goal", event.target.value)} placeholder="Ej. Ganar fuerza" className={`${inputClass} mt-1`} /></label><label>Peso (kg)<input type="number" min="0" step="0.1" value={form.weight || ""} onChange={(event) => set("weight", Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label>Altura (m)<input type="number" min="0" step="0.01" value={form.height || ""} onChange={(event) => set("height", Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label>IMC automático<div className={`${inputClass} mt-1 border-yellow-400/50 text-yellow-300`}>{bmi(form.weight, form.height)}</div></label><label>Plan<input required value={form.plan} onChange={(event) => set("plan", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Importe mensual<input required type="number" min="0" value={form.monthlyFee || ""} onChange={(event) => set("monthlyFee", Number(event.target.value))} className={`${inputClass} mt-1`} /></label><label>Estado<select value={form.status} onChange={(event) => set("status", event.target.value as StudentStatus)} className={`${inputClass} mt-1`}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label><label>Ingreso<input required type="date" value={form.joinedAt} onChange={(event) => set("joinedAt", event.target.value)} className={`${inputClass} mt-1`} /></label><label>Vencimiento<input required type="date" value={form.dueDate} onChange={(event) => set("dueDate", event.target.value)} className={`${inputClass} mt-1`} /></label></div><label className="mt-4 block">Observaciones<textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} rows={3} className={`${inputClass} mt-1`} /></label><button disabled={saving} className="mt-6 rounded-xl bg-yellow-400 px-5 py-3 font-bold text-zinc-950 disabled:opacity-60">{saving ? "Guardando…" : "Guardar alumno"}</button></form></div>; }
function StudentDetail({ item, close }: { item: Student; close: () => void }) { return <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4"><section className="mx-auto my-8 w-full max-w-2xl rounded-2xl bg-zinc-900 p-6 text-white"><div className="flex justify-between"><div><h2 className="text-xl font-bold">{item.firstName} {item.lastName}</h2><p className="text-sm text-zinc-400">{item.plan} · {item.status}</p></div><button onClick={close} className="text-zinc-400">Cerrar</button></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3"><div><dt className="text-zinc-500">Edad / IMC</dt><dd>{age(item.birthDate)} años · {bmi(item.weight, item.height)}</dd></div><div><dt className="text-zinc-500">Objetivo</dt><dd>{item.goal || "No definido"}</dd></div><div><dt className="text-zinc-500">Cuota</dt><dd>{money(item.monthlyFee)}</dd></div><div><dt className="text-zinc-500">Contacto</dt><dd>{item.phone}</dd></div><div><dt className="text-zinc-500">Vencimiento</dt><dd>{new Date(`${item.dueDate}T12:00:00`).toLocaleDateString("es-AR")}</dd></div><div><dt className="text-zinc-500">Historial básico</dt><dd>Ficha creada el {new Date(`${item.joinedAt}T12:00:00`).toLocaleDateString("es-AR")}</dd></div></dl><p className="mt-5 rounded-xl bg-zinc-950 p-4 text-sm text-zinc-300">{item.notes || "Sin observaciones."}</p><StudentAccessControls studentId={item.id} /><div className="mt-5 flex flex-wrap gap-3"><Link href="/pagos" className="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-zinc-950">Registrar pago</Link><Link href="/rutinas" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-yellow-400">Ver rutinas</Link><Link href="/evaluaciones" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-yellow-400">Ver evaluaciones</Link><Link href="/clases" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-yellow-400">Ver clases</Link></div></section></div>; }
