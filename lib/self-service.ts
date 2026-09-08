/** Account ownership is independent of the legacy billing/service enum. */
export function isSelfService(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && (value as Record<string, unknown>).accountType === "SELF_SERVICE");
}

export const SELF_SERVICE_GOALS = ["Ganar masa muscular", "Bajar grasa", "Mejorar salud", "Ganar fuerza", "Mejorar rendimiento", "Mantenerme activo"] as const;
export const TRAINING_LOCATIONS = ["Gimnasio", "Casa", "Aire libre"] as const;
export const EQUIPMENT_OPTIONS = ["Peso corporal", "Mancuernas", "Bandas", "Barra y discos", "Máquinas", "Banco"] as const;
export type SelfServicePreferences = { availableDays: number[]; sessionMinutes: number; trainingLocation: string; equipment: string[] };

export function selfServicePreferences(value: unknown): SelfServicePreferences {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    availableDays: Array.isArray(data.availableDays) ? data.availableDays.filter((day): day is number => typeof day === "number") : [],
    sessionMinutes: typeof data.sessionMinutes === "number" ? data.sessionMinutes : 0,
    trainingLocation: typeof data.trainingLocation === "string" ? data.trainingLocation : "",
    equipment: Array.isArray(data.equipment) ? data.equipment.filter((item): item is string => typeof item === "string") : [],
  };
}

export function selfServicePreferencesError(data: SelfServicePreferences) {
  if (!data.availableDays.length || data.availableDays.length > 7 || new Set(data.availableDays).size !== data.availableDays.length || data.availableDays.some((day) => !Number.isInteger(day) || day < 1 || day > 7)) return "Elegí tus días disponibles.";
  if (!Number.isInteger(data.sessionMinutes) || data.sessionMinutes < 15 || data.sessionMinutes > 120) return "Ingresá una duración entre 15 y 120 minutos.";
  if (!(TRAINING_LOCATIONS as readonly string[]).includes(data.trainingLocation)) return "Elegí dónde vas a entrenar.";
  if (!data.equipment.length || data.equipment.length > EQUIPMENT_OPTIONS.length || new Set(data.equipment).size !== data.equipment.length || data.equipment.some((item) => !(EQUIPMENT_OPTIONS as readonly string[]).includes(item))) return "Elegí el equipamiento disponible.";
  return "";
}

export type RegistrationInput = { firstName: string; lastName: string; email: string; phone: string; password: string; confirmPassword: string };
export function parseRegistration(value: unknown): RegistrationInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  const keys = ["firstName", "lastName", "email", "phone", "password", "confirmPassword"];
  if (Object.keys(input).some((key) => !keys.includes(key)) || keys.some((key) => typeof input[key] !== "string")) return null;
  const { firstName, lastName, email, phone, password, confirmPassword } = input as RegistrationInput;
  if (!firstName.trim() || firstName.length > 80 || !lastName.trim() || lastName.length > 80 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return null;
  const digits = phone.replace(/\D/g, "");
  if (phone.length > 40 || !/^[+\d\s().-]+$/.test(phone) || digits.length < 8 || digits.length > 15 || password !== confirmPassword) return null;
  return { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim().toLowerCase(), phone: phone.trim(), password, confirmPassword };
}
