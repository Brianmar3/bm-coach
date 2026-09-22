"use client";

import { FormEvent, useMemo, useRef, useState, type CSSProperties } from "react";
import { BmBellIcon, BmDeleteIcon, BmPaymentIcon, BmPlusIcon, BmSettingsIcon, BmSlidersIcon } from "@/componentes/icons";
import { ModuleShell, inputClass } from "@/componentes/module-shell";
import { PushDiagnostics } from "@/componentes/push-diagnostics";
import { PushNotificationsCard } from "@/componentes/push-notifications-card";
import { useBrowserStore } from "@/lib/browser-store";
import { planId, planSelectionKey, validateCoachPlans, validatePaymentMethods } from "@/lib/coach-plans";
import { emptyTransferDetails, normalizeTransferDetails, validateTransferDetails } from "@/lib/transfer-payment";
import type { CoachSettings } from "@/types/gestion";
import { WORKSPACE_BRANDING_EVENT } from "@/componentes/workspace-branding-provider";
import { WorkspaceBrandLogo } from "@/componentes/workspace-brand-logo";
import { allowedLogoModes, BM_DEFAULT_ACCENT, normalizeAccentColor, workspaceAccentColor, workspaceBrandingVariables, type WorkspaceBranding, type WorkspaceLogoMode } from "@/lib/workspace-branding";
import { workspaceLogoMetadataError } from "@/lib/workspace-logo-upload";

type Section = "general" | "personalizacion" | "cobros" | "planes" | "notificaciones" | "avanzado";
const sections: Array<{ id: Section; label: string }> = [{ id: "general", label: "General" }, { id: "personalizacion", label: "Personalización" }, { id: "cobros", label: "Cobros" }, { id: "planes", label: "Planes y precios" }, { id: "notificaciones", label: "Notificaciones" }, { id: "avanzado", label: "Avanzado" }];
const defaults: CoachSettings = { id: "main", systemName: "BM Training", coachName: "", phone: "", email: "", address: "", currency: "ARS", dueDay: 10, paymentMethods: ["Transferencia", "Efectivo"], transferDetails: emptyTransferDetails, plans: [], primaryColor: "#000000", accentColor: BM_DEFAULT_ACCENT, logoMode: "DEFAULT", customLogoUrl: "", brandingPlan: "STARTER", compactMode: false };
const accentPresets = [["Dorado BM", BM_DEFAULT_ACCENT], ["Azul", "#3B82F6"], ["Verde", "#22C55E"], ["Violeta", "#8B5CF6"], ["Rojo", "#EF4444"], ["Celeste", "#06B6D4"]] as const;

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
  const value = settings ?? (stored ? { ...defaults, ...stored, id: stored.id ?? "main", plans: hydratedPlans, transferDetails: normalizeTransferDetails(stored.transferDetails) } : defaults);
  function update<K extends keyof CoachSettings>(key: K, next: CoachSettings[K]) { setSettings({ ...value, [key]: next }); setSavedSection(null); setError(""); }
  function updateBranding(next: Partial<WorkspaceBranding>) { const updated = { ...value, ...next }; setSettings(updated); setSavedSection(null); setError(""); window.dispatchEvent(new CustomEvent(WORKSPACE_BRANDING_EVENT, { detail: updated })); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const validationError = validateCoachPlans(value.plans) ?? validatePaymentMethods(value.paymentMethods) ?? validateTransferDetails(value.transferDetails);
    if (validationError) { setError(validationError); setSavedSection(null); return; }
    setSaving(true); setError("");
    try { const result = await save([value]); const saved = result.settings ?? value; setSettings(saved); window.dispatchEvent(new CustomEvent(WORKSPACE_BRANDING_EVENT, { detail: { accentColor: saved.accentColor, logoMode: saved.logoMode, customLogoUrl: saved.customLogoUrl } })); setSavedSection(active); }
    catch (saveError) { setError(saveError instanceof Error ? saveError.message : "No se pudieron guardar los cambios."); setSavedSection(null); }
    finally { setSaving(false); }
  }
  function addPlan() { update("plans", [...value.plans, { id: crypto.randomUUID(), name: "Nuevo plan", price: 0 }]); }
  function addMethod() { setMethodKeys((current) => current.map((key, index) => index === value.paymentMethods.length ? crypto.randomUUID() : key)); update("paymentMethods", [...value.paymentMethods, "Nuevo método"]); }
  const currency = (amount: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: value.currency || "ARS", maximumFractionDigits: 2 }).format(amount);

  return <ModuleShell title="Configuración" subtitle="Administrá los datos y preferencias de tu espacio.">
    <nav aria-label="Secciones de configuración" className="mb-6 grid grid-cols-2 gap-2 rounded-2xl border border-zinc-800 bg-zinc-900 p-2 md:grid-cols-3 xl:grid-cols-6">
      {sections.map((section) => <button key={section.id} type="button" onClick={() => { setActive(section.id); setError(""); setSavedSection(null); }} aria-current={active === section.id ? "page" : undefined} className={`min-h-11 min-w-0 rounded-xl px-2 text-sm font-semibold transition ${active === section.id ? "bg-yellow-400 text-zinc-950" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>{section.label}</button>)}
    </nav>
    <form id="settings-form" onSubmit={submit} className="min-w-0 space-y-4">
      {savedSection === active && <p className="rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-200">Cambios de {sections.find((item) => item.id === active)?.label} guardados correctamente.</p>}
      {error && <p role="alert" className="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-sm text-red-200">{error}</p>}
      {active === "general" && <Panel title="General" description="Información principal que identifica a tu espacio." icon={<BmSettingsIcon className="size-5" />}><div className="grid gap-4 md:grid-cols-2">
        <Field label="Nombre del sistema"><input value={value.systemName} onChange={(e) => update("systemName", e.target.value)} className={inputClass} /></Field><Field label="Nombre del entrenador"><input value={value.coachName} onChange={(e) => update("coachName", e.target.value)} className={inputClass} /></Field><Field label="Teléfono"><input type="tel" value={value.phone} onChange={(e) => update("phone", e.target.value)} className={inputClass} /></Field><Field label="Correo"><input type="email" value={value.email} onChange={(e) => update("email", e.target.value)} className={inputClass} /></Field><Field label="Dirección"><input value={value.address} onChange={(e) => update("address", e.target.value)} className={inputClass} /></Field><Field label="Moneda"><select value={value.currency} onChange={(e) => update("currency", e.target.value)} className={inputClass}><option value="ARS">Peso argentino (ARS)</option><option value="USD">Dólar estadounidense (USD)</option><option value="EUR">Euro (EUR)</option></select></Field>
      </div><SaveButton saving={saving} label="Guardar General" /></Panel>}
      {active === "personalizacion" && <div className="workspace-brand" style={workspaceBrandingVariables(value.accentColor) as CSSProperties}><Panel title="Personalización" description="Este color identifica tu espacio y se aplica también al portal de todos tus alumnos." icon={<BmSlidersIcon className="size-5" />}>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.75fr)]"><div><Field label="Color principal"><div className="flex gap-3"><input aria-label="Selector visual de color principal" type="color" value={workspaceAccentColor(value.accentColor)} onChange={(event) => update("accentColor", event.target.value.toUpperCase())} className="h-11 w-16 cursor-pointer rounded-xl border border-zinc-700 bg-zinc-950 p-1" /><input aria-label="Color principal en formato HEX" value={value.accentColor || ""} onChange={(event) => update("accentColor", event.target.value.toUpperCase())} placeholder={BM_DEFAULT_ACCENT} maxLength={7} className={inputClass} /></div></Field><p className={`mt-2 text-xs ${normalizeAccentColor(value.accentColor) ? "text-zinc-500" : "text-red-300"}`}>{normalizeAccentColor(value.accentColor) ? "Formato HEX válido. Ejemplo: #3B82F6." : "Ingresá un color HEX de 6 dígitos, por ejemplo #3B82F6."}</p><div className="mt-5 flex flex-wrap gap-2" aria-label="Colores sugeridos">{accentPresets.map(([label, color]) => <button key={color} type="button" onClick={() => update("accentColor", color)} aria-pressed={workspaceAccentColor(value.accentColor) === color} className="flex min-h-10 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs font-semibold hover:border-zinc-500"><span className="size-4 rounded-full border border-white/20" style={{ backgroundColor: color }} />{label}</button>)}</div><button type="button" onClick={() => update("accentColor", BM_DEFAULT_ACCENT)} className="mt-4 min-h-10 rounded-xl px-2 text-sm font-semibold text-yellow-400">Restablecer color BM</button><WorkspaceLogoControls value={value} onChange={updateBranding} onError={setError} /></div><div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4"><p className="text-xs font-bold uppercase tracking-[.18em] text-zinc-500">Vista previa</p><div className="mt-4 rounded-xl border border-yellow-400/25 bg-yellow-400/10 p-4"><div className="flex items-center gap-3"><WorkspaceBrandLogo branding={value} className="h-14 w-14 rounded-xl" /><p className="font-bold text-yellow-300">Tu marca en BM Training</p></div><p className="mt-3 text-xs text-zinc-400">Botones, enlaces y estados activos usan el color del workspace.</p><button type="button" className="bm-accent-button mt-4 min-h-10 rounded-xl px-4 text-sm font-black">Acción principal</button></div></div></div>
        <SaveButton saving={saving} label="Guardar Personalización" />
      </Panel></div>}
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

const logoLabels: Record<WorkspaceLogoMode, string> = { DEFAULT: "Logo BM", WHITE: "Blanco", ACCENT: "Color principal", CUSTOM: "Logo propio" };

function WorkspaceLogoControls({ value, onChange, onError }: { value: CoachSettings; onChange: (next: Partial<WorkspaceBranding>) => void; onError: (message: string) => void }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ kind: "idle" | "uploading" | "success" | "error"; message: string }>({ kind: "idle", message: "" });
  const plan = value.brandingPlan ?? "STARTER";
  const modes = allowedLogoModes(plan);

  async function uploadLogo(file: File) {
    const validationError = workspaceLogoMetadataError(file);
    if (validationError) { setUploadStatus({ kind: "error", message: validationError }); onError(validationError); if (fileInput.current) fileInput.current.value = ""; return; }
    setUploading(true); setUploadStatus({ kind: "uploading", message: "Subiendo..." }); onError("");
    try {
      const form = new FormData(); form.set("logo", file);
      const response = await fetch("/api/workspace/logo", { method: "POST", body: form });
      const body = await response.json().catch(() => null) as { branding?: WorkspaceBranding; error?: string } | null;
      if (!response.ok || !body?.branding) throw new Error(body?.error ?? "No se pudo subir el logo. Intentá nuevamente.");
      onChange(body.branding);
      setUploadStatus({ kind: "success", message: "Logo actualizado" });
    } catch (error) { const message = error instanceof Error ? error.message : "No se pudo subir el logo. Intentá nuevamente."; setUploadStatus({ kind: "error", message }); onError(message); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function removeLogo() {
    setUploading(true); setUploadStatus({ kind: "uploading", message: "Eliminando..." }); onError("");
    try {
      const response = await fetch("/api/workspace/logo", { method: "DELETE" });
      const body = await response.json() as { branding?: WorkspaceBranding; error?: string };
      if (!response.ok || !body.branding) throw new Error(body.error ?? "No se pudo eliminar el logo.");
      onChange(body.branding);
      setUploadStatus({ kind: "success", message: "Logo eliminado" });
    } catch (error) { const message = error instanceof Error ? error.message : "No se pudo eliminar el logo."; setUploadStatus({ kind: "error", message }); onError(message); }
    finally { setUploading(false); }
  }

  return <div className="mt-7 border-t border-zinc-800 pt-5"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-semibold">Estilo del logo</p><p className="mt-1 text-xs text-zinc-500">Opciones disponibles para tu plan {plan}.</p></div><span className="rounded-full border border-yellow-400/25 px-2 py-1 text-[10px] font-bold text-yellow-300">{plan}</span></div><div className="mt-3 grid grid-cols-2 gap-2">{modes.map((mode) => <button key={mode} type="button" disabled={mode === "CUSTOM" && !value.customLogoUrl} onClick={() => onChange({ logoMode: mode })} aria-pressed={value.logoMode === mode} className={`min-h-11 rounded-xl border px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${value.logoMode === mode ? "border-yellow-400 bg-yellow-400/10 text-yellow-300" : "border-zinc-700 bg-zinc-950 text-zinc-300"}`}>{logoLabels[mode]}</button>)}</div>{plan === "PREMIUM" && <div className="mt-4 flex flex-wrap gap-2"><label className={`inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-yellow-400/30 px-3 text-xs font-bold text-yellow-300 ${uploading ? "pointer-events-none opacity-50" : ""}`}><input ref={fileInput} type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp" disabled={uploading} className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadLogo(file); }} /><span>{uploading ? "Subiendo..." : value.customLogoUrl ? "Reemplazar logo" : "Subir logo propio"}</span></label>{value.customLogoUrl && <button type="button" disabled={uploading} onClick={() => void removeLogo()} className="min-h-10 rounded-xl border border-red-400/25 px-3 text-xs font-bold text-red-300 disabled:opacity-50">Eliminar logo</button>}<button type="button" disabled={uploading} onClick={() => onChange({ logoMode: "DEFAULT" })} className="min-h-10 rounded-xl px-3 text-xs font-bold text-zinc-300 disabled:opacity-50">Volver al logo BM</button><p className="w-full text-[11px] text-zinc-500">PNG, JPG o WEBP · máximo 3 MB.</p>{uploadStatus.message && <p role={uploadStatus.kind === "error" ? "alert" : "status"} aria-live="polite" className={`w-full text-xs font-semibold ${uploadStatus.kind === "success" ? "text-emerald-300" : uploadStatus.kind === "error" ? "text-red-300" : "text-yellow-300"}`}>{uploadStatus.message}</p>}</div>}</div>;
}
