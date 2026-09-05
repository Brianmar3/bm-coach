"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";

type FormState = { goal: string; weight: string; heightCm: string; birthDate: string; trainingExperience: string; hasLimitations: boolean | null; limitations: string; observations: string };
const initial: FormState = { goal: "", weight: "", heightCm: "", birthDate: "", trainingExperience: "", hasLimitations: null, limitations: "", observations: "" };
const goals = [
  ["Bajar grasa", "flame"], ["Ganar masa muscular", "dumbbell"], ["Mejorar mi salud", "heart"],
  ["Ganar fuerza", "bars"], ["Mejorar resistencia", "runner"], ["Mantenerme activo/a", "spark"],
] as const;

function Icon({ name, className = "size-7" }: { name: string; className?: string }) {
  const paths: Record<string, ReactNode> = {
    flame: <path d="M12 22c4 0 7-3 7-7 0-3-2-6-5-9 0 3-1 4-2 5 0-4-2-7-4-9 0 5-3 7-3 12 0 5 3 8 7 8Zm0-2c-2 0-3-1-3-3 0-1 1-3 2-4 0 2 1 3 2 4 1-1 1-2 1-3 1 1 2 3 2 4 0 1-2 2-4 2Z"/>,
    dumbbell: <><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12"/></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.8-7.5 1.1-1.1a5.5 5.5 0 0 0-.1-7.8Z"/>,
    bars: <><path d="M5 20v-6M10 20V9M15 20V5M20 20V2"/></>,
    runner: <><circle cx="15" cy="4" r="2"/><path d="m13 8-3 4 4 2 2 5M13 8l4 3 3-1M10 12l-3 6M14 14l-4 6"/></>,
    spark: <><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8"/><circle cx="12" cy="12" r="2"/></>,
    check: <path d="m5 12 4 4L19 6"/>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function Brand() {
  return <div className="onboarding-brand"><Image src="/bm-training-mark.png" width={72} height={72} priority alt="Ícono de pesa rusa BM"/><span>Training</span></div>;
}

export function StudentOnboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((current) => ({ ...current, [key]: value }));
  const back = () => { setError(""); setStep((value) => Math.max(0, value - 1)); };
  function next() {
    setError("");
    if (step === 1 && !form.goal) return setError("Elegí el objetivo que mejor te representa.");
    if (step === 2 && (!(Number(form.weight) >= 25 && Number(form.weight) <= 350) || !(Number(form.heightCm) >= 100 && Number(form.heightCm) <= 250) || !form.birthDate)) return setError("Completá peso, altura y fecha de nacimiento con valores válidos.");
    if (step === 3 && !form.trainingExperience) return setError("Seleccioná tu nivel de experiencia.");
    if (step === 4 && (form.hasLimitations === null || (form.hasLimitations && form.limitations.trim().length < 3))) return setError("Indicá si tenés molestias y, si corresponde, describilas brevemente.");
    setStep((value) => value + 1);
  }
  async function finish(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const response = await fetch("/api/portal/onboarding", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "No pudimos guardar tus datos.");
      setStep(6);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "No pudimos guardar tus datos."); }
    finally { setSaving(false); }
  }
  const goHome = () => { router.push("/portal"); router.refresh(); };

  return <main className="onboarding-shell"><div className="onboarding-aurora"/><section className="onboarding-phone" aria-live="polite">
    {step === 0 ? <div className="onboarding-welcome onboarding-enter"><Brand/><div className="onboarding-orbit" aria-hidden="true"><span/><span/><span/><div><Icon name="bars" className="size-10"/></div></div><div><p className="onboarding-eyebrow">Tu progreso comienza acá</p><h1>Bienvenido/a a<br/><strong>BM Training</strong></h1><p>Antes de empezar, completá unos datos para personalizar mejor tu experiencia.</p></div><button className="onboarding-primary" onClick={next}>Comenzar <span>→</span></button><small>Un mejor entrenamiento comienza conociéndote.</small></div> :
    step === 6 ? <div className="onboarding-confirm onboarding-enter"><Brand/><div className="onboarding-success"><Icon name="check" className="size-12"/></div><div><p className="onboarding-eyebrow">Perfil completado</p><h1>Tus datos fueron guardados correctamente.</h1><p>Ahora tu entrenador podrá tener mejor información para acompañarte.</p></div><button className="onboarding-primary" onClick={goHome}>Ir al inicio <span>→</span></button><small>Disciplina hoy, resultados mañana.</small></div> :
    <form className="onboarding-form onboarding-enter" onSubmit={step === 5 ? finish : (event) => { event.preventDefault(); next(); }}>
      <header><button type="button" className="onboarding-back" onClick={back} aria-label="Volver">‹</button><span>Paso {step} de 5</span><Brand/></header>
      <div className="onboarding-progress" aria-label={`Paso ${step} de 5`}>{[1,2,3,4,5].map((item) => <i className={item <= step ? "active" : ""} key={item}/>)}</div>
      <div className="onboarding-content">
        {step === 1 && <><h1>Objetivo principal</h1><p>¿Qué querés lograr con nosotros?</p><div className="onboarding-goals">{goals.map(([label, icon]) => <button type="button" key={label} aria-pressed={form.goal === label} onClick={() => update("goal", label)}><Icon name={icon}/><span>{label}</span>{form.goal === label && <Icon name="check" className="onboarding-card-check"/>}</button>)}</div></>}
        {step === 2 && <><h1>Datos físicos</h1><p>Contanos un poco sobre vos.</p><div className="onboarding-fields"><label><span>Peso actual</span><div><input inputMode="decimal" type="number" min="25" max="350" step="0.1" value={form.weight} onChange={(e) => update("weight", e.target.value)} placeholder="Ej. 70" required/><b>kg</b></div></label><label><span>Altura</span><div><input inputMode="numeric" type="number" min="100" max="250" value={form.heightCm} onChange={(e) => update("heightCm", e.target.value)} placeholder="Ej. 178" required/><b>cm</b></div></label><label><span>Fecha de nacimiento</span><div><input type="date" max={new Date().toISOString().slice(0,10)} value={form.birthDate} onChange={(e) => update("birthDate", e.target.value)} required/></div></label></div></>}
        {step === 3 && <><h1>Tu experiencia</h1><p>Esto nos ayuda a mostrarte una experiencia más adecuada para vos.</p><div className="onboarding-levels">{["Principiante", "Intermedio", "Avanzado"].map((level) => <button type="button" key={level} aria-pressed={form.trainingExperience === level} onClick={() => update("trainingExperience", level)}><span>{level}</span><small>{level === "Principiante" ? "Estoy dando mis primeros pasos" : level === "Intermedio" ? "Entreno con cierta regularidad" : "Tengo experiencia sostenida"}</small></button>)}</div></>}
        {step === 4 && <><h1>Experiencia y salud</h1><p>Queremos acompañarte de forma segura.</p><fieldset><legend>¿Tenés alguna molestia o limitación?</legend><div className="onboarding-toggle"><button type="button" aria-pressed={form.hasLimitations === false} onClick={() => update("hasLimitations", false)}>No tengo molestias</button><button type="button" aria-pressed={form.hasLimitations === true} onClick={() => update("hasLimitations", true)}>Sí, tengo molestias</button></div></fieldset>{form.hasLimitations && <label className="onboarding-textarea"><span>Describila brevemente</span><textarea autoFocus rows={5} maxLength={800} value={form.limitations} onChange={(e) => update("limitations", e.target.value)} placeholder="Ej: dolor lumbar, rodilla, hombro, operación previa, etc."/></label>}</>}
        {step === 5 && <><h1>Observaciones finales</h1><p>¿Hay algo más que tu entrenador debería saber?</p><label className="onboarding-textarea"><span>Información adicional <em>Opcional</em></span><textarea rows={7} maxLength={1200} value={form.observations} onChange={(e) => update("observations", e.target.value)} placeholder="Podés contar algo que creas importante sobre tu entrenamiento, hábitos o salud."/></label><div className="onboarding-note"><Icon name="spark" className="size-6"/><p>Esta información será visible para tu entrenador y le permitirá acompañarte mejor.</p></div></>}
      </div>
      {error && <p className="onboarding-error" role="alert">{error}</p>}
      <div className="onboarding-actions">{step > 1 && <button type="button" className="onboarding-secondary" onClick={back}>Volver</button>}<button disabled={saving} className="onboarding-primary">{saving ? "Guardando…" : step === 5 ? "Finalizar" : "Continuar"} <span>→</span></button></div>
    </form>}
  </section></main>;
}
