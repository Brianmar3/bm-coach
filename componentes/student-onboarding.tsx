"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type ComponentType } from "react";
import {
  BmBackIcon, BmBarbellIcon, BmCalendarIcon, BmCheckIcon, BmEditIcon, BmFlameIcon,
  BmHealthIcon, BmInfoIcon, BmMeasurementsIcon, BmMoreIcon, BmProfileIcon,
  BmProgressIcon, BmRankingIcon, BmTargetIcon, BmWeightIcon, type BmIconProps,
} from "@/componentes/icons";
import { EXPERIENCE_LEVELS, ONBOARDING_GOALS, TRAINING_EXPERIENCE, onboardingValidation, type StudentOnboardingData } from "@/lib/student-onboarding";

const goalIcons: Record<(typeof ONBOARDING_GOALS)[number], ComponentType<BmIconProps>> = {
  "Ganar masa muscular": BmBarbellIcon,
  "Bajar grasa": BmFlameIcon,
  "Mejorar salud": BmHealthIcon,
  "Ganar fuerza": BmProgressIcon,
  "Mejorar rendimiento": BmRankingIcon,
  Otro: BmMoreIcon,
};

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="onboarding-brand"><Image src="/bm-training-mark.png" alt="" width={72} height={72} priority /><span>BM <strong>Training</strong></span>{!compact && <small>Gestión, entrenamiento<br />tu mejor versión.</small>}</div>;
}

export function StudentOnboarding({ initial }: { initial: StudentOnboardingData }) {
  const router = useRouter();
  const [step, setStep] = useState<0 | 1 | 2 | 3 | 4>(0);
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function saveStep(next: 2 | 3 | 4 | 5) {
    const currentStep = step as 1 | 2 | 3 | 4;
    const validation = onboardingValidation(form, currentStep);
    if (validation) return setError(validation);
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/portal/onboarding", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ step: currentStep, complete: next === 5, data: form }) });
      const body = await response.json() as { data?: StudentOnboardingData; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error ?? "No pudimos guardar tus datos.");
      setForm(body.data);
      if (next === 5) { router.replace("/portal"); router.refresh(); }
      else setStep(next);
    } catch (value) { setError(value instanceof Error ? value.message : "No pudimos guardar tus datos."); }
    finally { setSaving(false); }
  }

  return <main className="onboarding-shell"><div className="onboarding-aurora" /><div className="onboarding-phone">
    {step === 0 ? <section className="onboarding-welcome onboarding-enter">
      <Brand />
      <div><h1>Completa tu <strong>perfil</strong></h1><p>Son unos datos rápidos para<br />personalizar mejor tu seguimiento.</p></div>
      <div className="onboarding-orbit" aria-label="Perfil, salud y progreso"><span /><span /><span /><div><BmTargetIcon size={38} /></div><i className="onboarding-orbit-icon onboarding-orbit-icon-profile"><BmProfileIcon size={22} /></i><i className="onboarding-orbit-icon onboarding-orbit-icon-health"><BmHealthIcon size={22} /></i><i className="onboarding-orbit-icon onboarding-orbit-icon-progress"><BmProgressIcon size={22} /></i></div>
      <div className="w-full"><button type="button" onClick={() => setStep(1)} className="onboarding-primary">Empezar <span>→</span></button><small className="mt-3 block">Un mejor entrenamiento<br />comienza conociéndote.</small></div>
    </section> : <section className={step === 4 ? "onboarding-confirm onboarding-enter" : "onboarding-form onboarding-enter"}>
      {step < 4 && <><header><button type="button" className="onboarding-back" onClick={() => setStep((step - 1) as 0 | 1 | 2)} aria-label="Volver"><BmBackIcon size={24} /></button><span>{step} de 4</span><Brand compact /></header><div className="onboarding-progress" aria-label={`Paso ${step} de 4`}>{[1, 2, 3, 4].map((item) => <i key={item} className={item <= step ? "active" : ""} />)}</div></>}
      {step === 1 && <div className="onboarding-content"><h1>Datos físicos</h1><p>Contanos un poco sobre vos.</p><div className="onboarding-fields">
        <Field Icon={BmCalendarIcon} label="Fecha de nacimiento"><input type="date" value={form.birthDate} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></Field>
        <Field Icon={BmMeasurementsIcon} label="Altura"><input type="number" inputMode="numeric" min="80" max="250" placeholder="Ej. 178" value={form.height || ""} onChange={(event) => setForm({ ...form, height: Number(event.target.value) })} /><b>cm</b></Field>
        <Field Icon={BmWeightIcon} label="Peso actual"><input type="number" inputMode="decimal" min="25" max="350" step="0.1" placeholder="Ej. 70" value={form.weight || ""} onChange={(event) => setForm({ ...form, weight: Number(event.target.value) })} /><b>kg</b></Field>
      </div></div>}
      {step === 2 && <div className="onboarding-content"><h1>Objetivo principal</h1><p>¿Qué querés lograr con nosotros?</p><div className="onboarding-goals">{ONBOARDING_GOALS.map((goal) => { const Icon = goalIcons[goal]; const selected = form.goal === goal; return <button type="button" key={goal} aria-pressed={selected} onClick={() => setForm({ ...form, goal })}>{selected && <BmCheckIcon className="onboarding-card-check" />}<Icon size={28} className="text-yellow-400" /><span>{goal}</span></button>; })}</div></div>}
      {step === 3 && <div className="onboarding-content"><h1>Experiencia y salud</h1><p>Esto nos ayuda a armar un mejor plan.</p>
        <fieldset><legend>Nivel de experiencia</legend><div className="onboarding-levels onboarding-levels-inline">{EXPERIENCE_LEVELS.map((level) => <button type="button" key={level} aria-pressed={form.experienceLevel === level} onClick={() => setForm({ ...form, experienceLevel: level })}><span>{level}</span></button>)}</div></fieldset>
        <label className="onboarding-select"><span>¿Hace cuánto entrenás?</span><select value={form.trainingExperience} onChange={(event) => setForm({ ...form, trainingExperience: event.target.value })}><option value="">Seleccionar</option>{TRAINING_EXPERIENCE.map((value) => <option key={value}>{value}</option>)}</select></label>
        <fieldset><legend>¿Tenés alguna molestia o limitación?</legend><div className="onboarding-toggle"><button type="button" aria-pressed={!form.hasLimitations} onClick={() => setForm({ ...form, hasLimitations: false, limitations: "" })}>No</button><button type="button" aria-pressed={form.hasLimitations} onClick={() => setForm({ ...form, hasLimitations: true })}>Sí {form.hasLimitations && <BmCheckIcon size={17} />}</button></div></fieldset>
        {form.hasLimitations && <label className="onboarding-textarea"><span>Describila brevemente</span><em>{form.limitations.length}/500</em><textarea rows={3} maxLength={500} value={form.limitations} onChange={(event) => setForm({ ...form, limitations: event.target.value })} placeholder="Ej. Dolor de rodilla, lesión previa, etc." /></label>}
        <div className="onboarding-note"><BmInfoIcon size={20} /><p>No hace falta un diagnóstico médico. Contanos sólo lo que necesitás que tu entrenador tenga en cuenta.</p></div>
      </div>}
      {step < 4 && <footer>{error && <p role="alert" className="onboarding-error">{error}</p>}<button type="button" disabled={saving} onClick={() => void saveStep((step + 1) as 2 | 3 | 4)} className="onboarding-primary">{saving ? "Guardando…" : "Continuar"} <span>→</span></button></footer>}
      {step === 4 && <><div className="onboarding-progress onboarding-progress-complete">{[1, 2, 3, 4].map((item) => <i key={item} className="active" />)}</div><div className="onboarding-success"><BmCheckIcon size={48} /></div><div><h1>Perfil completado</h1><p>Ya podemos adaptar mejor tu<br />seguimiento.</p></div><section className="onboarding-summary"><header><strong>Tu información</strong><button type="button" onClick={() => setStep(1)}>Editar <BmEditIcon size={15} /></button></header><Summary Icon={BmMeasurementsIcon} label="Altura" value={`${form.height} cm`} /><Summary Icon={BmWeightIcon} label="Peso actual" value={`${form.weight} kg`} /><Summary Icon={BmBarbellIcon} label="Objetivo principal" value={form.goal} /><Summary Icon={BmProgressIcon} label="Nivel de experiencia" value={form.experienceLevel} /></section>{error && <p role="alert" className="onboarding-error">{error}</p>}<div className="w-full"><button type="button" disabled={saving} onClick={() => void saveStep(5)} className="onboarding-primary">{saving ? "Guardando…" : "Ir a BM Training"} <span>→</span></button><small className="mt-3 block">Disciplina hoy, resultados mañana.</small></div></>}
    </section>}
  </div></main>;
}

function Field({ Icon, label, children }: { Icon: ComponentType<BmIconProps>; label: string; children: React.ReactNode }) { return <label><span><Icon size={18} />{label}</span><div>{children}</div></label>; }
function Summary({ Icon, label, value }: { Icon: ComponentType<BmIconProps>; label: string; value: string }) { return <div><Icon size={18} /><span>{label}</span><strong>{value}</strong></div>; }
