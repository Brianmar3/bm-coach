import type { CoachPlan, CoachSettings, Student, StudentPlanOption } from "@/types/gestion";

export function normalizePlanName(value: string) {
  return value.trim().replace(/\s+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

export function legacyPlanId(plan: Pick<CoachPlan, "name">, index: number) {
  const slug = normalizePlanName(plan.name).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "sin-nombre";
  return `legacy-plan-${slug}-${index + 1}`;
}

export function planId(plan: CoachPlan, index: number) {
  return plan.id?.trim() || legacyPlanId(plan, index);
}

export function plansWithIds(plans: CoachPlan[] | undefined): Required<CoachPlan>[] {
  return (plans ?? []).map((plan, index) => ({ id: planId(plan, index), name: plan.name, price: plan.price }));
}

export function validateCoachPlans(plans: CoachPlan[]) {
  const names = new Set<string>();
  const ids = new Set<string>();
  for (const [index, plan] of plans.entries()) {
    const name = normalizePlanName(plan.name);
    if (!name) return "Todos los planes deben tener un nombre.";
    if (names.has(name)) return `El plan “${plan.name.trim()}” está repetido.`;
    names.add(name);
    const id = planId(plan, index);
    if (ids.has(id)) return "Hay planes con identificadores repetidos. Volvé a cargar la página e intentá otra vez.";
    ids.add(id);
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
  return plansWithIds(settings?.plans)
    .filter((plan) => !validateCoachPlans([plan]))
    .map((plan) => ({ id: plan.id, days: plan.id, name: plan.name.trim(), price: Number(plan.price), configured: true as const }))
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
}

export function assignedPlan(
  student: Pick<Student, "plan" | "planId">,
  plans: Required<CoachPlan>[],
) {
  if (student.planId) {
    const byId = plans.find((plan) => plan.id === student.planId);
    if (byId) return byId;
  }
  const name = normalizePlanName(student.plan ?? "");
  return plans.find((plan) => normalizePlanName(plan.name) === name);
}

export function removedAssignedPlan(
  students: Array<Pick<Student, "firstName" | "lastName" | "plan" | "planId">>,
  currentPlans: Required<CoachPlan>[],
  nextPlans: Required<CoachPlan>[],
) {
  const nextIds = new Set(nextPlans.map((plan) => plan.id));
  for (const student of students) {
    const previousPlan = assignedPlan(student, currentPlans);
    if (previousPlan && !nextIds.has(previousPlan.id)) return { student, plan: previousPlan };
  }
  return null;
}

export function synchronizedStudentPlan(
  student: Student,
  currentPlans: Required<CoachPlan>[],
  nextPlans: Required<CoachPlan>[],
) {
  const previousPlan = assignedPlan(student, currentPlans);
  const nextPlan = previousPlan ? nextPlans.find((plan) => plan.id === previousPlan.id) : undefined;
  return nextPlan ? { ...student, planId: nextPlan.id, plan: nextPlan.name, monthlyFee: nextPlan.price } : student;
}
