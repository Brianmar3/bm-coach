"use client";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { StudentAccessControls } from "@/componentes/student-access-controls";
import { StudentAttendanceSummaryCard } from "@/componentes/student-attendance-summary";
import type { Student, StudentPlanOption, StudentStatus } from "@/types/gestion";
type StudentFormValue = Omit<Student, "id" | "scheduleId" | "scheduleLabel" | "scheduleLabels"> & {
    scheduleId: string;
    scheduleIds: string[];
    flexibleSchedule: string;
};
type EnrollmentSchedule = {
    id: string;
    label: string;
    active: boolean;
    capacity: number | null;
    assigned: number;
};
type EnrollmentOptions = {
    plans: StudentPlanOption[];
    schedules: EnrollmentSchedule[];
};
function nextMonthlyDate(value: string) { const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value); if (!match)
    return ""; const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]); const valid = new Date(Date.UTC(year, month - 1, day)); if (valid.toISOString().slice(0, 10) !== value)
    return ""; const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate(); return new Date(Date.UTC(year, month, Math.min(day, lastDay))).toISOString().slice(0, 10); }
function money(value: number) { return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value); }
function showDate(value: string) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("es-AR") : "Sin definir"; }
function age(birthDate: string) { if (!birthDate)
    return "—"; const now = new Date(); const birth = new Date(`${birthDate}T12:00:00`); return now.getFullYear() - birth.getFullYear() - Number(now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())); }
function bmi(weight: number, height: number) { return weight > 0 && height > 0 ? (weight / (height * height)).toFixed(1) : "—"; }
async function responseError(response: Response, fallback: string) { try {
    return ((await response.json()) as {
        error?: string;
    }).error ?? fallback;
}
catch {
    return fallback;
} }
function blank(options: EnrollmentOptions, previous?: Pick<StudentFormValue, "plan" | "joinedAt" | "status" | "studentType" | "responsibleName" | "responsiblePhone" | "responsibleRelation">): StudentFormValue {
    const joinedAt = previous?.joinedAt ?? "";
    const plan = options.plans.find((item) => item.name === previous?.plan) ?? options.plans[0];
    return { firstName: "", lastName: "", phone: "", email: "", birthDate: "", weight: 0, height: 0, goal: "", plan: plan?.name ?? "2 días por semana", monthlyFee: plan?.price ?? 0, joinedAt, dueDate: "", status: previous?.status ?? "activo", notes: "", studentType: previous?.studentType ?? "Adulto", responsibleName: previous?.responsibleName ?? "", responsiblePhone: previous?.responsiblePhone ?? "", responsibleRelation: previous?.responsibleRelation ?? "", scheduleId: "", scheduleIds: [], flexibleSchedule: "" };
}
function editValue(student: Student): StudentFormValue {
    return { firstName: student.firstName, lastName: student.lastName, phone: student.phone, email: student.email, birthDate: student.birthDate, weight: student.weight, height: student.height, goal: student.goal, plan: student.plan, monthlyFee: student.monthlyFee, joinedAt: student.joinedAt, dueDate: student.dueDate, status: student.status, notes: student.notes, studentType: student.studentType ?? "Adulto", responsibleName: student.responsibleName ?? "", responsiblePhone: student.responsiblePhone ?? "", responsibleRelation: student.responsibleRelation ?? "", scheduleId: student.scheduleIds?.[0] ?? student.scheduleId ?? "", scheduleIds: student.scheduleIds ?? (student.scheduleId ? [student.scheduleId] : []), flexibleSchedule: student.flexibleSchedule ?? "" };
}
export default function AlumnosPage() {
    const [items, setItems] = useState<Student[]>([]);
    const [options, setOptions] = useState<EnrollmentOptions>({ plans: [], schedules: [] });
    const [ready, setReady] = useState(false);
    const [query, setQuery] = useState("");
    const [status, setStatus] = useState("todos");
    const [plan, setPlan] = useState("todos");
    const [scheduleFilter, setScheduleFilter] = useState("todos");
    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<Student | null>(null);
    const [viewing, setViewing] = useState<Student | null>(null);
    const [form, setForm] = useState<StudentFormValue>(() => blank({ plans: [], schedules: [] }));
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [saving, setSaving] = useState(false);
    useEffect(() => {
        const controller = new AbortController();
        Promise.all([
            fetch("/api/alumnos", { signal: controller.signal, cache: "no-store" }).then(async (response) => { if (!response.ok)
                throw new Error(await responseError(response, "No se pudieron cargar los alumnos.")); return response.json() as Promise<Student[]>; }),
            fetch("/api/alumnos/opciones", { signal: controller.signal, cache: "no-store" }).then(async (response) => { if (!response.ok)
                throw new Error(await responseError(response, "No se pudieron cargar planes y horarios.")); return response.json() as Promise<EnrollmentOptions>; }),
        ]).then(([students, enrollmentOptions]) => {
            setItems(students);
            setOptions(enrollmentOptions);
            const params = new URLSearchParams(window.location.search);
            if (params.get("estado") === "activo")
                setStatus("activo");
            if (params.get("buscar"))
                setQuery(params.get("buscar") ?? "");
            if (params.get("accion") === "nuevo") {
                setForm(blank(enrollmentOptions));
                setOpen(true);
            }
        }).catch((loadError: unknown) => { if (loadError instanceof Error && loadError.name !== "AbortError")
            setError(loadError.message); }).finally(() => setReady(true));
        return () => controller.abort();
    }, []);
    const plans = useMemo(() => [...new Set(items.map((item) => item.plan))].sort((left, right) => left.localeCompare(right, "es")), [items]);
    const visible = items.filter((item) => {
        const matchesSchedule = scheduleFilter === "todos"
            || (scheduleFilter === "sin-horario" && !item.scheduleIds?.length && !item.flexibleSchedule)
            || (scheduleFilter === "flexible" && Boolean(item.flexibleSchedule))
            || item.scheduleIds?.includes(scheduleFilter);
        return `${item.firstName} ${item.lastName} ${item.phone}`.toLocaleLowerCase("es").includes(query.toLocaleLowerCase("es"))
            && (status === "todos" || item.status === status)
            && (plan === "todos" || item.plan === plan)
            && matchesSchedule;
    });
    function begin(item?: Student) { setEditing(item ?? null); setForm(item ? editValue(item) : blank(options)); setError(""); setNotice(""); setViewing(null); setOpen(true); }
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
        const addAnother = !editing && submitter?.value === "another";
        if (!form.firstName.trim() || !form.lastName.trim()) {
            setError("Ingresá nombre y apellido.");
            return;
        }
        const phoneDigits = form.phone.replace(/\D/g, "");
        if (form.studentType !== "Kids" && phoneDigits.length < 6) {
            setError("Ingresá un teléfono válido de al menos 6 dígitos.");
            return;
        }
        if (form.studentType === "Kids" && phoneDigits && phoneDigits.length < 6) {
            setError("Ingresá un teléfono válido de al menos 6 dígitos.");
            return;
        }
        if (!form.plan || !form.joinedAt) {
            setError("Seleccioná plan y fecha de inicio.");
            return;
        }
        setSaving(true);
        setError("");
        setNotice("");
        try {
            const response = await fetch(editing ? `/api/alumnos/${editing.id}` : "/api/alumnos", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
            if (!response.ok)
                throw new Error(await responseError(response, "No se pudo guardar el alumno."));
            const saved = await response.json() as Student;
            setItems((current) => editing ? current.map((item) => item.id === saved.id ? saved : item) : [saved, ...current]);
            if (editing) {
                setOpen(false);
                setEditing(null);
            }
            else if (addAnother) {
                setForm(blank(options, form));
                setNotice(`${saved.firstName} ${saved.lastName} fue guardado. Podés agregar otro alumno.`);
            }
            else
                setOpen(false);
        }
        catch (saveError) {
            setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el alumno.");
        }
        finally {
            setSaving(false);
        }
    }
    async function remove(item: Student) {
        if (!window.confirm(`¿Eliminar a ${item.firstName} ${item.lastName}?`))
            return;
        setError("");
        try {
            const response = await fetch(`/api/alumnos/${item.id}`, { method: "DELETE" });
            if (!response.ok)
                throw new Error(await responseError(response, "No se pudo eliminar el alumno."));
            setItems((current) => current.filter((student) => student.id !== item.id));
            if (viewing?.id === item.id)
                setViewing(null);
        }
        catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar el alumno.");
        }
    }
    return <ModuleShell title="Alumnos" subtitle="Alta rápida, planes y seguimiento de tu cartera de alumnos." action={<button onClick={() => begin()} className="rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950">+ Nuevo alumno</button>}>
    {error && !open && <p role="alert" className="mb-5 rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
    <div className="mb-3"><label className="text-xs text-zinc-500">Filtrar por horario<select value={scheduleFilter} onChange={(event) => setScheduleFilter(event.target.value)} className={`${inputClass} mt-1 w-full sm:max-w-sm`}><option value="todos">Todos los horarios</option><option value="sin-horario">Sin horario</option><option value="flexible">Horario flexible</option>{options.schedules.map((schedule) => <option key={schedule.id} value={schedule.id}>{schedule.label}</option>)}</select></label></div>
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900"><div className="grid gap-3 border-b border-zinc-800 p-4 md:grid-cols-3"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, apellido o teléfono" className={inputClass}/><select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="todos">Todos los estados</option><option value="activo">Activos</option><option value="inactivo">Inactivos</option></select><select value={plan} onChange={(event) => setPlan(event.target.value)} className={inputClass}><option value="todos">Todos los planes</option>{plans.map((item) => <option key={item}>{item}</option>)}</select></div><div className="overflow-x-auto"><table className="w-full min-w-[880px] text-left text-sm"><thead className="text-zinc-500"><tr><th className="p-4">Alumno</th><th>Plan</th><th>Horario principal</th><th>Contacto</th><th>Vencimiento</th><th>Estado</th><th aria-label="Acciones"/></tr></thead><tbody>{!ready ? <tr><td colSpan={7} className="p-12 text-center text-zinc-500">Cargando alumnos…</td></tr> : visible.length === 0 ? <tr><td colSpan={7} className="p-12 text-center text-zinc-500">Todavía no hay alumnos. Creá la primera ficha para empezar.</td></tr> : visible.map((item) => <tr key={item.id} className="border-t border-zinc-800"><td className="p-4 font-medium">{item.firstName} {item.lastName}<span className="block text-xs font-normal text-zinc-500">IMC {bmi(item.weight, item.height)} · {age(item.birthDate)} años</span></td><td>{item.plan}<span className="block text-xs text-zinc-500">{money(item.monthlyFee)}</span></td><td className="max-w-56 text-xs text-zinc-400">{item.scheduleLabel ?? "Sin horario principal"}</td><td>{item.phone}<span className="block text-xs text-zinc-500">{item.email || "Sin correo"}</span></td><td>{showDate(item.dueDate)}</td><td><span className={`rounded-full px-2 py-1 text-xs font-bold capitalize ${item.status === "activo" ? "bg-emerald-400/15 text-emerald-300" : "bg-zinc-700 text-zinc-300"}`}>{item.status}</span></td><td className="space-x-3 whitespace-nowrap pr-4 text-yellow-400"><button onClick={() => setViewing(item)}>Ver ficha</button><button onClick={() => begin(item)}>Editar</button><button onClick={() => remove(item)} className="text-red-300">Eliminar</button></td></tr>)}</tbody></table></div></section>
    {open && <><StudentForm form={form} setForm={setForm} options={options} error={error} notice={notice} close={() => setOpen(false)} submit={submit} editing={Boolean(editing)} saving={saving}/><EnrollmentDatesEditor form={form} setForm={setForm}/><ScheduleMultiPicker form={form} setForm={setForm} schedules={options.schedules}/></>}
    {viewing && <StudentDetail item={viewing} close={() => setViewing(null)} edit={() => begin(viewing)}/>}
  </ModuleShell>;
}

function EnrollmentDatesEditor({ form, setForm }: { form: StudentFormValue; setForm: (form: StudentFormValue) => void }) {
    const [open, setOpen] = useState(false);
    return <>
      <button type="button" onClick={() => setOpen(true)} className="fixed bottom-20 left-3 z-[60] rounded-full border border-yellow-400/40 bg-zinc-900 px-4 py-3 text-sm font-bold text-yellow-300 shadow-2xl">Fechas</button>
      {open && <div role="presentation" onPointerDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }} className="fixed inset-0 z-[70] flex items-end bg-black/75 sm:items-center sm:justify-center sm:p-4">
        <section role="dialog" aria-modal="true" aria-labelledby="student-dates-title" className="w-full rounded-t-3xl border border-zinc-700 bg-zinc-900 p-4 text-white sm:max-w-md sm:rounded-2xl">
          <div className="flex items-start justify-between gap-3"><div><h3 id="student-dates-title" className="font-bold">Ingreso y vencimiento</h3><p className="mt-1 text-xs text-zinc-500">Son datos independientes.</p></div><button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-400">Cerrar</button></div>
          <div className="mt-4 space-y-4">
            <label className="block text-sm">Fecha de ingreso<input required type="date" value={form.joinedAt} onChange={(event) => setForm({ ...form, joinedAt: event.target.value })} className={`${inputClass} mt-1`}/><span className="mt-1 block text-xs text-zinc-500">Se conserva como fecha histórica del alumno.</span></label>
            <label className="block text-sm">Próximo vencimiento<input type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} className={`${inputClass} mt-1`}/><span className="mt-1 block text-xs text-zinc-500">Se actualiza con los pagos, sin modificar el ingreso.</span></label>
            <button type="button" disabled={!form.joinedAt} onClick={() => setForm({ ...form, dueDate: nextMonthlyDate(form.joinedAt) })} className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-yellow-300 disabled:opacity-40">Calcular un mes después</button>
          </div>
          <button type="button" onClick={() => setOpen(false)} className="mt-5 w-full rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950">Confirmar fechas</button>
        </section>
      </div>}
    </>;
}

function ScheduleMultiPicker({ form, setForm, schedules }: { form: StudentFormValue; setForm: (form: StudentFormValue) => void; schedules: EnrollmentSchedule[] }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    useEffect(() => {
        if (form.scheduleId && !form.scheduleIds.includes(form.scheduleId))
            setForm({ ...form, scheduleIds: [...form.scheduleIds, form.scheduleId] });
    }, [form, setForm]);
    const visible = schedules.filter((schedule) => schedule.label.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")) && (schedule.active || form.scheduleIds.includes(schedule.id)));
    function toggle(id: string) {
        if (form.scheduleIds.includes(id) && !window.confirm("¿Quitar este horario? Dejará de aplicarse a futuro y se conservarán las asistencias anteriores."))
            return;
        const scheduleIds = form.scheduleIds.includes(id) ? form.scheduleIds.filter((item) => item !== id) : [...form.scheduleIds, id];
        setForm({ ...form, scheduleIds, scheduleId: scheduleIds[0] ?? "" });
    }
    return <div className="fixed bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] right-4 z-[65]">
      <button type="button" onClick={() => setOpen(true)} className="rounded-full bg-yellow-400 px-4 py-3 text-sm font-bold text-zinc-950 shadow-2xl">Horarios ({form.scheduleIds.length})</button>
      {open && <div className="fixed inset-0 z-[70] flex items-end bg-black/75 sm:items-center sm:justify-center sm:p-4" onMouseDown={(event) => { if (event.target === event.currentTarget)
                setOpen(false); }}>
        <section className="max-h-[85dvh] w-full overflow-y-auto rounded-t-2xl border border-zinc-800 bg-zinc-900 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-2xl">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">Horarios semanales</h3><p className="mt-1 text-xs text-zinc-500">Seleccioná ninguno, uno o varios horarios.</p></div><button type="button" onClick={() => setOpen(false)} className="text-sm text-zinc-400">Cerrar</button></div>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por día, hora o clase" className={`${inputClass} mt-4`}/>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">{visible.map((schedule) => <label key={schedule.id} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${form.scheduleIds.includes(schedule.id) ? "border-yellow-400/50 bg-yellow-400/5" : "border-zinc-800 bg-zinc-950"}`}><input type="checkbox" checked={form.scheduleIds.includes(schedule.id)} onChange={() => toggle(schedule.id)} disabled={!schedule.active && !form.scheduleIds.includes(schedule.id)} className="h-5 w-5 accent-yellow-400"/><span className="min-w-0 flex-1 text-sm">{schedule.label}<span className="block text-xs text-zinc-500">{schedule.capacity === null ? "Sin cupo máximo" : `${schedule.assigned}/${schedule.capacity} asignados`}</span></span></label>)}</div>
          {!visible.length && <p className="mt-3 rounded-xl bg-zinc-950 p-4 text-center text-sm text-zinc-500">No se encontraron horarios.</p>}
          <label className="mt-4 block text-sm">Horario flexible <span className="text-xs text-zinc-500">(solo informativo)</span><input value={form.flexibleSchedule} onChange={(event) => setForm({ ...form, flexibleSchedule: event.target.value })} placeholder="Ej. Turno tarde o 18:00" className={`${inputClass} mt-1`}/><span className="mt-1 block text-xs text-zinc-500">No genera clases ni asistencias automáticamente.</span></label>
          <button type="button" onClick={() => setOpen(false)} className="mt-4 w-full rounded-xl bg-yellow-400 px-4 py-3 font-bold text-zinc-950">Confirmar horarios</button>
        </section>
      </div>}
    </div>;
}

function StudentForm({ form, setForm, options, error, notice, close, submit, editing, saving }: {
    form: StudentFormValue;
    setForm: (form: StudentFormValue) => void;
    options: EnrollmentOptions;
    error: string;
    notice: string;
    close: () => void;
    submit: (event: FormEvent<HTMLFormElement>) => void;
    editing: boolean;
    saving: boolean;
}) {
    function set<K extends keyof StudentFormValue>(key: K, value: StudentFormValue[K]) { setForm({ ...form, [key]: value }); }
    function choosePlan(name: string) { const selected = options.plans.find((plan) => plan.name === name); setForm({ ...form, plan: name, monthlyFee: selected?.price ?? 0 }); }
    function chooseStart(value: string) { setForm({ ...form, joinedAt: value }); }
    const selectedPlan = options.plans.find((plan) => plan.name === form.plan);
    return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-2 sm:p-4"><form onSubmit={submit} className="mx-auto my-2 w-full max-w-3xl rounded-2xl border border-zinc-800 bg-zinc-900 text-white shadow-2xl sm:my-8"><div className="flex items-start justify-between border-b border-zinc-800 p-4 sm:p-6"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-yellow-400">{editing ? "Ficha completa" : "Alta rápida"}</p><h2 className="mt-1 text-xl font-bold">{editing ? "Editar alumno" : "Nuevo alumno"}</h2><p className="mt-1 text-xs text-zinc-500">{editing ? "Actualizá los datos personales y deportivos." : "Solo los datos esenciales. El resto se completa después."}</p></div><button type="button" onClick={close} disabled={saving} className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800">Cerrar</button></div><div className="p-4 sm:p-6">{error && <p role="alert" className="mb-4 rounded-xl border border-red-400/30 bg-red-400/10 p-3 text-sm text-red-200">{error}</p>}{notice && <p className="mb-4 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}<div className="grid gap-4 sm:grid-cols-2"><label className="text-sm">Nombre *<input autoFocus required value={form.firstName} onChange={(event) => set("firstName", event.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-sm">Apellido *<input required value={form.lastName} onChange={(event) => set("lastName", event.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-sm">Tipo de alumno<select value={form.studentType ?? "Adulto"} onChange={(event) => set("studentType", event.target.value as "Adulto" | "Kids")} className={`${inputClass} mt-1`}><option value="Adulto">Adulto</option><option value="Kids">Kids</option></select></label><label className="text-sm">Teléfono{form.studentType !== "Kids" ? " *" : ""}<input required={form.studentType !== "Kids"} type="tel" inputMode="tel" value={form.phone} onChange={(event) => set("phone", event.target.value)} placeholder={form.studentType === "Kids" ? "Opcional para Kids" : "Ej. 11 5555-1234"} className={`${inputClass} mt-1`}/></label>{form.studentType === "Kids" && <div className="sm:col-span-2 rounded-xl border border-zinc-800 bg-zinc-950/80 p-3"><p className="text-sm font-semibold text-yellow-300">Contacto responsable</p><div className="mt-3 grid gap-3 sm:grid-cols-3"><label className="text-sm">Nombre<input value={form.responsibleName ?? ""} onChange={(event) => set("responsibleName", event.target.value)} className={`${inputClass} mt-1`} placeholder="Ej. Ana Pérez"/></label><label className="text-sm">Teléfono<input value={form.responsiblePhone ?? ""} onChange={(event) => set("responsiblePhone", event.target.value)} className={`${inputClass} mt-1`} placeholder="Ej. 11 5555-1234"/></label><label className="text-sm">Vínculo<select value={form.responsibleRelation ?? ""} onChange={(event) => set("responsibleRelation", event.target.value)} className={`${inputClass} mt-1`}><option value="">Seleccioná</option><option value="Madre">Madre</option><option value="Padre">Padre</option><option value="Tutor">Tutor</option><option value="Otro">Otro</option></select></label></div></div>}<label className="text-sm">Plan mensual *<select required value={form.plan} onChange={(event) => choosePlan(event.target.value)} className={`${inputClass} mt-1`}>{options.plans.map((plan) => <option key={plan.days} value={plan.name}>{plan.name} · {money(plan.price)}</option>)}</select>{selectedPlan && !selectedPlan.configured && <span className="mt-1 block text-xs text-yellow-300">Precio todavía en $0. Configuralo en Configuración.</span>}</label><label className="text-sm">Estado *<select value={form.status} onChange={(event) => set("status", event.target.value as StudentStatus)} className={`${inputClass} mt-1`}><option value="activo">Activo</option><option value="inactivo">Inactivo</option></select></label><label className="text-sm">Fecha de inicio *<input required type="date" value={form.joinedAt} onChange={(event) => chooseStart(event.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-sm">Horario o grupo <span className="text-xs text-zinc-500">(opcional)</span><select value={form.scheduleId} onChange={(event) => set("scheduleId", event.target.value)} className={`${inputClass} mt-1`}><option value="">Sin horario asignado</option>{options.schedules.map((schedule) => <option key={schedule.id} value={schedule.id} disabled={!schedule.active && schedule.id !== form.scheduleId}>{schedule.label}{schedule.capacity === null ? "" : ` · ${schedule.assigned}/${schedule.capacity}`}{schedule.active ? "" : " · Inactivo"}</option>)}</select><span className="mt-1 block text-xs text-zinc-500">Se puede asignar o cambiar después desde la edición del alumno.</span></label><div className="rounded-xl bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Importe automático</p><p className="mt-1 font-bold text-yellow-400">{money(form.monthlyFee)}</p></div><div className="rounded-xl bg-zinc-950 p-3"><p className="text-xs text-zinc-500">Primer vencimiento</p><p className="mt-1 font-bold">{showDate(form.dueDate)}</p></div></div>
        {editing && <section className="mt-6 border-t border-zinc-800 pt-5"><h3 className="font-semibold">Datos complementarios</h3><p className="mt-1 text-xs text-zinc-500">Todos estos campos son opcionales.</p><div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><label className="text-sm">Correo<input type="email" value={form.email} onChange={(event) => set("email", event.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-sm">Fecha de nacimiento<input type="date" value={form.birthDate} onChange={(event) => set("birthDate", event.target.value)} className={`${inputClass} mt-1`}/></label><label className="text-sm">Objetivo<input value={form.goal} onChange={(event) => set("goal", event.target.value)} placeholder="Ej. Ganar fuerza" className={`${inputClass} mt-1`}/></label><label className="text-sm">Peso (kg)<input type="number" min="0" max="500" step="0.1" value={form.weight || ""} onChange={(event) => set("weight", Number(event.target.value))} className={`${inputClass} mt-1`}/></label><label className="text-sm">Altura (m)<input type="number" min="0" max="3" step="0.01" value={form.height || ""} onChange={(event) => set("height", Number(event.target.value))} className={`${inputClass} mt-1`}/></label><div><p className="text-sm">IMC automático</p><div className={`${inputClass} mt-1 border-yellow-400/50 text-yellow-300`}>{bmi(form.weight, form.height)}</div></div></div><label className="mt-4 block text-sm">Observaciones<textarea value={form.notes} onChange={(event) => set("notes", event.target.value)} rows={3} className={`${inputClass} mt-1`}/></label></section>}
      </div><div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:justify-end sm:p-5"><button type="button" onClick={close} disabled={saving} className="rounded-xl border border-zinc-700 px-5 py-3 font-semibold text-zinc-300">Cancelar</button>{!editing && <button type="submit" name="saveAction" value="another" disabled={saving} className="rounded-xl border border-yellow-400/50 px-5 py-3 font-bold text-yellow-300 disabled:opacity-50">Guardar y agregar otro</button>}<button type="submit" name="saveAction" value="close" disabled={saving} className="rounded-xl bg-yellow-400 px-5 py-3 font-bold text-zinc-950 disabled:opacity-50">{saving ? "Guardando…" : "Guardar"}</button></div></form></div>;
}
function StudentDetail({ item, close, edit }: {
    item: Student;
    close: () => void;
    edit: () => void;
}) { return <div className="fixed inset-0 z-50 overflow-y-auto bg-black/85 p-3 sm:p-4"><section className="mx-auto my-3 w-full max-w-4xl rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-white sm:my-8 sm:p-6"><div className="flex items-start justify-between gap-4"><div><h2 className="text-xl font-bold">{item.firstName} {item.lastName}</h2><p className="text-sm text-zinc-400">{item.plan} · {item.status}</p></div><button onClick={close} className="text-zinc-400">Cerrar</button></div><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><Detail label="Edad / IMC" value={`${age(item.birthDate)} años · ${bmi(item.weight, item.height)}`}/><Detail label="Objetivo" value={item.goal || "No definido"}/><Detail label="Cuota" value={money(item.monthlyFee)}/><Detail label="Contacto" value={item.phone}/><Detail label="Vencimiento" value={showDate(item.dueDate)}/><Detail label="Fecha de inicio" value={showDate(item.joinedAt)}/><Detail label="Horario principal" value={item.scheduleLabel ?? "Sin horario principal"} wide/></dl><p className="mt-5 rounded-xl bg-zinc-950 p-4 text-sm text-zinc-300">{item.notes || "Sin observaciones."}</p><StudentAttendanceSummaryCard studentId={item.id}/><StudentAccessControls studentId={item.id}/><div className="mt-5 flex flex-wrap gap-3"><button onClick={edit} className="rounded-lg bg-yellow-400 px-3 py-2 text-sm font-bold text-zinc-950">Completar o editar ficha</button><Link href="/asistencias" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-yellow-400">Ver asistencias</Link><Link href="/pagos" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-yellow-400">Registrar pago</Link><Link href="/rutinas" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-yellow-400">Ver rutinas</Link><Link href="/evaluaciones" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-yellow-400">Ver evaluaciones</Link><Link href="/clases" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-yellow-400">Ver clases</Link></div></section></div>; }
function Detail({ label, value, wide = false }: {
    label: string;
    value: string;
    wide?: boolean;
}) { return <div className={wide ? "sm:col-span-2" : ""}><dt className="text-zinc-500">{label}</dt><dd className="mt-1">{value}</dd></div>; }
