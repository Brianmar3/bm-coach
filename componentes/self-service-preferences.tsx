"use client";

import { EQUIPMENT_OPTIONS, TRAINING_LOCATIONS, selfServicePreferences } from "@/lib/self-service";
import type { StudentOnboardingData } from "@/lib/student-onboarding";

export function SelfServicePreferencesFields({ value, onChange }: { value: StudentOnboardingData; onChange: (value: StudentOnboardingData) => void }) {
  const prefs = selfServicePreferences(value);
  return <div className="mt-6 space-y-5">
    <fieldset><legend>Días disponibles</legend><div className="mt-2 grid grid-cols-4 gap-2">{["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((day, index) => <button className="min-h-11 rounded-xl border border-zinc-700 px-2 text-sm aria-pressed:border-yellow-400 aria-pressed:text-yellow-300" type="button" key={day} aria-pressed={prefs.availableDays.includes(index + 1)} onClick={() => onChange({ ...value, availableDays: prefs.availableDays.includes(index + 1) ? prefs.availableDays.filter((item) => item !== index + 1) : [...prefs.availableDays, index + 1].sort() })}>{day}</button>)}</div></fieldset>
    <label className="onboarding-select"><span>Minutos por sesión</span><input className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-900 p-3" type="number" min={15} max={120} value={prefs.sessionMinutes || ""} onChange={(event) => onChange({ ...value, sessionMinutes: Number(event.target.value) })} /></label>
    <label className="onboarding-select"><span>¿Dónde entrenás?</span><select value={prefs.trainingLocation} onChange={(event) => onChange({ ...value, trainingLocation: event.target.value })}><option value="">Seleccionar</option>{TRAINING_LOCATIONS.map((place) => <option key={place}>{place}</option>)}</select></label>
    <fieldset><legend>Equipamiento disponible</legend><div className="mt-2 grid grid-cols-2 gap-2">{EQUIPMENT_OPTIONS.map((item) => <label key={item} className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 p-3 text-sm"><input className="accent-yellow-400" type="checkbox" checked={prefs.equipment.includes(item)} onChange={(event) => onChange({ ...value, equipment: event.target.checked ? [...prefs.equipment, item] : prefs.equipment.filter((equipment) => equipment !== item) })} />{item}</label>)}</div></fieldset>
  </div>;
}
