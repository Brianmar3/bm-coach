import type { CoachPlan, CoachSettings, Student, StudentPlanOption } from "@/types/gestion";

const LEGACY_PLAN_ID_PREFIX = "legacy-plan-";

export function normalizePlanName(value: string) {
  const normalized = value
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/\bdias\b/g, "dia")
    .replace(/\bsemanas\b/g, "semana");
  return normalized === "plan casa" ? "plan en casa" : normalized;
}

export function canonicalPlanName(value: string) {
  const normalized = normalizePlanName(value);
  const frequency = /^([2-5]) dia por semana$/.exec(normalized);
  if (frequency) return `${frequency[1]} días por semana`;
  if (normalized === "plan en casa") return "Plan en casa";
  return value.trim().replace(/\s+/g, " ");
}

export function isPersistentPlanId(value: unknown): value is string {
  return typeof value === "string"
    && Boolean(value.trim())
    && !value.trim().startsWith(LEGACY_PLAN_ID_PREFIX)
    && !value.trim().startsWith("legacy:")
    && !value.trim().startsWith("id:");
}

/** Real persisted identity only. Legacy UI identifiers are deliberately discarded. */
export function planId(plan: Pick<CoachPlan, "id">) {
  return isPersistentPlanId(plan.id) ? plan.id.trim() : "";
}

/** Client-only identity for React keys/select values. It must never be persisted as planId. */
export function planSelectionKey(plan: Pick<CoachPlan, "id" | "name" | "price">) {
  const persistentId = planId(plan);
  return persistentId ? `id:${persistentId}` : `legacy:${normalizePlanName(plan.name)}:${Number(plan.price)}`;
}

export function plansWithIds(plans: CoachPlan[] | undefined): Array<CoachPlan & { id: string }> {
  return (plans ?? []).map((plan) => ({ ...plan, id: planId(plan) }));
}

export function validateCoachPlans(plans: CoachPlan[]) {
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const plan of plans) {
    const name = normalizePlanName(plan.name);
    if (!name) return "Todos los planes deben tener un nombre.";
    if (names.has(name)) return `El plan “${plan.name.trim()}” está repetido.`;
    names.add(name);
    const persistentId = planId(plan);
    if (persistentId && ids.has(persistentId)) return "Hay planes con identificadores repetidos. Volvé a cargar la página e intentá otra vez.";
    if (persistentId) ids.add(persistentId);
    if (!Number.isFinite(plan.price) || plan.price < 0) return `El precio de “${plan.name.trim()}” no puede ser negativo.`;
  }
  return null;
}

export function validatePaymentMethods(methods: string[]) {
  const normalized = methods.map(normalizePlanName);
  if (normalized.some((method) => !method)) return "Todos los métodos de pago deben tener un nombre.";
  if (new Set(normalized).size !== normalized.length) return "No puede haber métodos de pago repetidos.";
  return null;
}

export function studentPlanOptions(settings: CoachSettings | undefined): StudentPlanOption[] {
  const grouped = new Map<string, StudentPlanOption>();
  for (const plan of plansWithIds(settings?.plans)) {
    if (validateCoachPlans([plan])) continue;
    const name = canonicalPlanName(plan.name);
    const option = {
      id: planSelectionKey(plan),
      persistentId: plan.id,
      selectionKey: planSelectionKey(plan),
      days: planSelectionKey(plan),
      name,
      price: Number(plan.price),
      configured: true as const,
    };
    const key = normalizePlanName(name);
    const existing = grouped.get(key);
    if (!existing || (!existing.persistentId && option.persistentId)) grouped.set(key, option);
  }
  return [...grouped.values()].sort((left, right) => left.name.localeCompare(right.name, "es"));
}

export type PlanResolution =
  | { status: "matched"; plan: StudentPlanOption }
  | { status: "ambiguous"; candidates: StudentPlanOption[] }
  | { status: "missing"; candidates: [] };

export function resolveStudentPlan(
  student: Pick<Student, "plan" | "planId" | "monthlyFee">,
  plans: StudentPlanOption[],
): PlanResolution {
  if (isPersistentPlanId(student.planId)) {
    const byId = plans.find((plan) => plan.persistentId === student.planId);
    if (byId) return { status: "matched", plan: byId };
  }
  const normalizedName = normalizePlanName(student.plan ?? "");
  let candidates = normalizedName ? plans.filter((plan) => normalizePlanName(plan.name) === normalizedName) : [];
  if (candidates.length > 1 && Number.isFinite(student.monthlyFee)) {
    candidates = candidates.filter((plan) => plan.price === Number(student.monthlyFee));
  }
  if (candidates.length === 1) return { status: "matched", plan: candidates[0] };
  if (candidates.length > 1) return { status: "ambiguous", candidates };
  return { status: "missing", candidates: [] };
}

export function assignedPlan(
  student: Pick<Student, "plan" | "planId" | "monthlyFee">,
  plans: Array<CoachPlan & { id: string }>,
) {
  const options = studentPlanOptions({ plans } as CoachSettings);
  const resolution = resolveStudentPlan(student, options);
  if (resolution.status !== "matched") return undefined;
  return plans.find((plan) => plan.id && plan.id === resolution.plan.persistentId)
    ?? plans.find((plan) => normalizePlanName(plan.name) === normalizePlanName(resolution.plan.name));
}

export function removedAssignedPlan(
  students: Array<Pick<Student, "firstName" | "lastName" | "plan" | "planId" | "monthlyFee">>,
  currentPlans: Array<CoachPlan & { id: string }>,
  nextPlans: Array<CoachPlan & { id: string }>,
) {
  const currentOptions = studentPlanOptions({ plans: currentPlans } as CoachSettings);
  const nextOptions = studentPlanOptions({ plans: nextPlans } as CoachSettings);
  for (const student of students) {
    const previous = resolveStudentPlan(student, currentOptions);
    if (previous.status !== "matched") continue;
    const retained = resolveStudentPlan({ ...student, plan: previous.plan.name, planId: previous.plan.persistentId, monthlyFee: previous.plan.price }, nextOptions);
    if (retained.status !== "matched") return { student, plan: previous.plan };
  }
  return null;
}

export function synchronizedStudentPlan(
  student: Student,
  currentPlans: Array<CoachPlan & { id: string }>,
  nextPlans: Array<CoachPlan & { id: string }>,
) {
  const current = resolveStudentPlan(student, studentPlanOptions({ plans: currentPlans } as CoachSettings));
  if (current.status !== "matched") return student;
  const next = resolveStudentPlan(
    { ...student, plan: current.plan.name, planId: current.plan.persistentId, monthlyFee: current.plan.price },
    studentPlanOptions({ plans: nextPlans } as CoachSettings),
  );
  return next.status === "matched"
    ? { ...student, planId: next.plan.persistentId, plan: next.plan.name, monthlyFee: next.plan.price }
    : student;
}

export function buildStudentEnrollmentPayload<T extends object & { planId?: string; selectionKey?: string }>(value: T) {
  const payload = { ...value };
  delete payload.selectionKey;
  const selected = typeof value.planId === "string" && value.planId.startsWith("id:") ? value.planId.slice(3) : value.planId;
  return { ...payload, planId: isPersistentPlanId(selected) ? selected.trim() : "" };
}
