"use client";

import { FormEvent, useMemo, useState } from "react";
import { BmBellIcon, BmDeleteIcon, BmPaymentIcon, BmPlusIcon, BmSettingsIcon, BmSlidersIcon } from "@/componentes/icons";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { PushDiagnostics } from "@/componentes/push-diagnostics";
import { PushNotificationsCard } from "@/componentes/push-notifications-card";
import { useBrowserStore } from "@/lib/browser-store";
import { planId, planSelectionKey, validateCoachPlans, validatePaymentMethods } from "@/lib/coach-plans";
import { emptyTransferDetails, normalizeTransferDetails, validateTransferDetails } from "@/lib/transfer-payment";
import type { CoachSettings } from "@/types/gestion";

type Section = "general" | "cobros" | "planes" | "notificaciones" | "avanzado";
const sections: Array<{ id: Section; label: string }> = [{ id: "general", label: "General" }, { id: "cobros", label: "Cobros" }, { id: "planes", label: "Planes y precios" }, { id: "notificaciones", label: "Notificaciones" }, { id: "avanzado", label: "Avanzado" }];
const defaults: CoachSettings = { id: "main", systemName: "BM Training", coachName: "", phone: "", email: "", address: "", currency: "ARS", dueDay: 10, paymentMethods: ["Transferencia", "Efectivo"], transferDetails: emptyTransferDetails, plans: [], primaryColor: "#000000", accentColor: "#facc15", compactMode: false };

export default function ConfiguracionPage() {
  const { items, save, ready } = useBrowserStore<CoachSettings>("bm-coach-settings", []);
  const [active, setActive] = useState<Section>("general");
  const [settings, setSettings] = useState<CoachSettings | null>(null);
  const [savedSection, setSavedSection] = useState<Section | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [methodKeys, setMethodKeys] = useState(() => Array.from({ length: 64 }, () => crypto.randomUUID()));
  const stored = items[0];
  const hydratedPlans = useMemo(() => stored?.plans.map((plan) => ({ ...plan, id: planId(plan) || crypto.randomUUID() })) ?? [], [stored]);
  const value = settings ?? (stored ? { ...stored, id: stored.id ?? "main", plans: hydratedPlans, transferDetails: normalizeTransferDetails(stored.transferDetails) } : defaults);
  function update<K extends keyof CoachSettings>(key: K, next: CoachSettings[K]) { setSettings({ ...value, [key]: next }); setSavedSection(null); setError(""); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateCoachPlans(value.plans) ?? validatePaymentMethods(value.paymentMethods) ?? validateTransferDetails(value.transferDetails);
    if (validationError) { setError(validationError); setSavedSection(null); return; }
    setSaving(true); setError("");
    try { const result = await save([value]); setSettings(result.settings ?? value); setSavedSection(active); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar los cambios."); setSavedSection(null); }
    finally { setSaving(false); }
  }
  function addPlan() { update("plans", [...value.plans, { id: crypto.randomUUID(), name: "Nuevo plan", price: 0 }]); }
  function addMethod() { setMethodKeys((current) => current.map((key, index) => index === value.paymentMethods.length ? crypto.randomUUID() : key)); update("paymentMethods", [...value.paymentMethods, "Nuevo método"]); }
  const currency = (amount: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: value.currency || "ARS", maximumFractionDigits: 2 }).format(amount);

  return <ModuleShell title="Configuración" subtitle="Administrá los datos y preferencias de tu espacio.">
    <nav aria-label="Secciones de configuración" className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-2 md:grid-cols-5">
      {sections.map((section) => <button key={section.id} type="button" onClick={() => { setActive(section.id); setError(""); setSavedSection(null); }} aria-current={active === section.id ? "page" : undefined} className={`min-h-11 min-w-0 rounded-xl px-2 text-sm font-semibold transition ${active === section.id ? "bg-yellow-400 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>{section.label}</button>)}
    </nav>
    <form id="settings-form" onSubmit={submit} className="min-w-0 space-y-4">
      {savedSection === active && <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">Cambios de {sections.find((item) => item.id === active)?.label} guardados correctamente.</p>}
      {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      {active === "general" && <Panel title="General" description="Información principal que identifica a tu espacio." icon={<BmSettingsIcon className="size-5" />}><div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre del sistema"><input value={value.systemName} onChange={(e) => update("systemName", e.target.value)} className={inputClass} /></Field><Field label="Nombre del entrenador"><input value={value.coachName} onChange={(e) => update("coachName", e.target.value)} className={inputClass} /></Field><Field label="Teléfono"><input type="tel" value={value.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} /></Field><Field label="Correo"><input type="email" value={value.email} onChange={(e) => update("email", e.target.value)} className={inputClass} /></Field><Field label="Dirección"><input value={value.address} onChange={(e) => update("address", e.target.value)} className={inputClass} /></Field><Field label="Moneda"><select value={value.currency} onChange={(e) => update("currency", e.target.value)} className={inputClass}><option value="ARS">Peso argentino (ARS)</option><option value="USD">Dólar estadounidense (USD)</option><option value="EUR">Euro (EUR)</option></select></Field>
      </div><SaveButton saving={saving} label="Guardar General" /></Panel>}
      {active === "cobros" && <Panel title="Cobros" description="Definí vencimientos y las formas disponibles para pagar." icon={<BmPaymentIcon className="size-5" />}><div className="grid gap-5 md:grid-cols-2"><Field label="Día habitual de vencimiento"><input type="number" min="1" max="31" value={value.dueDay} onChange={(e) => update("dueDay", Number(e.target.value))} className={inputClass} /></Field><div><p className="text-sm">Métodos de pago</p><div className="mt-2 space-y-2">{value.paymentMethods.map((method, index) => <div key={methodKeys[index] ?? `pending-method-${index}`} className="flex min-w-0 gap-2"><input value={method} onChange={(e) => update("paymentMethods", value.paymentMethods.map((item, i) => i === index ? e.target.value : item))} className={inputClass} /><IconButton label="Quitar método" onClick={() => { setMethodKeys((current) => current.filter((_, i) => i !== index)); update("paymentMethods", value.paymentMethods.filter((_, i) => i !== index)); }} /></div>)}<AddButton onClick={addMethod}>Agregar método</AddButton></div></div></div>
        <div className="mt-6 border-t border-zinc-800 pt-5"><h3 className="font-semibold">Datos de transferencia</h3><p className="mt-1 text-xs text-zinc-500">Se muestran al alumno de forma informativa. Configurá al menos alias o CBU/CVU.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Titular"><input value={value.transferDetails?.holder ?? ""} onChange={(e) => update("transferDetails", { ...normalizeTransferDetails(value.transferDetails), holder: e.target.value })} className={inputClass} /></Field><Field label="Banco o billetera"><input value={value.transferDetails?.institution ?? ""} onChange={(e) => update("transferDetails", { ...normalizeTransferDetails(value.transferDetails), institution: e.target.value })} className={inputClass} /></Field><Field label="Alias"><input value={value.transferDetails?.alias ?? ""} onChange={(e) => update("transferDetails", { ...normalizeTransferDetails(value.transferDetails), alias: e.target.value })} className={inputClass} /></Field><Field label="CBU o CVU"><input inputMode="numeric" value={value.transferDetails?.accountNumber ?? ""} onChange={(e) => update("transferDetails", { ...normalizeTransferDetails(value.transferDetails), accountNumber: e.target.value })} className={inputClass} /></Field></div></div><SaveButton saving={saving} label="Guardar Cobros" /></Panel>}
      {active === "planes" && <Panel title="Planes y precios" description="Planes reales disponibles al cargar o editar alumnos." icon={<BmSlidersIcon className="size-5" />}><div className="space-y-3">{value.plans.length === 0 && <p className="rounded-xl bg-zinc-950 p-4 text-sm text-zinc-400">Todavía no hay planes configurados.</p>}{value.plans.map((plan, index) => <div key={`${planSelectionKey(plan)}:${index}`} className="grid min-w-0 gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-end"><Field label="Nombre"><input value={plan.name} onChange={(e) => update("plans", value.plans.map((item, i) => i === index ? { ...item, name: e.target.value } : item))} className={inputClass} /></Field><Field label={`Precio · ${currency(plan.price)}`}><input type="number" min="0" step="0.01" value={plan.price} onChange={(e) => update("plans", value.plans.map((item, i) => i === index ? { ...item, price: Number(e.target.value) } : item))} className={inputClass} /></Field><button type="button" onClick={() => update("plans", value.plans.filter((_, i) => i !== index))} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-400/20 px-3 text-sm text-red-300"><BmDeleteIcon className="size-4" />Eliminar</button></div>)}<AddButton onClick={addPlan}>Agregar plan</AddButton></div><SaveButton saving={saving} label="Guardar Planes y precios" /></Panel>}
      {active === "notificaciones" && <div className="space-y-4"><SectionTitle icon={<BmBellIcon className="size-5" />} title="Notificaciones" text="Activá o desactivá los avisos de asistencia en este dispositivo." /><PushNotificationsCard audience="trainer" /></div>}
      {active === "avanzado" && <div className="space-y-4"><SectionTitle icon={<BmSlidersIcon className="size-5" />} title="Avanzado" text="Información técnica para revisar entregas de notificaciones." /><PushDiagnostics /></div>}
      {!ready && <p className="text-sm text-zinc-500">Cargando configuración…</p>}
    </form>
  </ModuleShell>;
}

function Panel({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) { return <section className="min-w-0 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6"><header className="mb-5 flex items-start gap-3"><span className="mt-0.5 text-yellow-400">{icon}</span><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-sm text-zinc-500">{description}</p></div></header>{children}</section>; }
function SectionTitle({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="flex items-center gap-2 px-1 text-yellow-400">{icon}<div><h2 className="font-semibold text-white">{title}</h2><p className="text-sm text-zinc-500">{text}</p></div></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block min-w-0 text-sm">{label}<div className="mt-1">{children}</div></label>; }
function SaveButton({ saving, label }: { saving: boolean; label: string }) { return <div className="mt-6 flex justify-end"><button disabled={saving} className="min-h-11 w-full rounded-xl bg-yellow-400 px-4 py-2.5 font-bold text-zinc-950 disabled:opacity-50 sm:w-auto">{saving ? "Guardando…" : label}</button></div>; }
function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <button type="button" onClick={onClick} className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-yellow-400"><BmPlusIcon className="size-4" />{children}</button>; }
function IconButton({ label, onClick }: { label: string; onClick: () => void }) { return <button type="button" aria-label={label} onClick={onClick} className="grid min-h-11 min-w-11 shrink-0 place-items-center rounded-xl border border-red-400/20 text-red-300"><BmDeleteIcon className="size-4" /></button>; }
