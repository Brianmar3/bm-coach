import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assignedPlan, buildStudentEnrollmentPayload, normalizePlanName, plansWithIds, removedAssignedPlan, resolveStudentPlan, studentPlanOptions,
  selectedStudentPlanFormValue, studentPlanFormValue, synchronizedStudentPlan, validateCoachPlans,
} from "../lib/coach-plans.ts";
import type { CoachSettings, Student } from "../types/gestion.ts";

const settings = (plans: CoachSettings["plans"]): CoachSettings => ({
  id: "main", systemName: "BM", coachName: "", phone: "", email: "", address: "", currency: "ARS",
  dueDay: 10, paymentMethods: ["Efectivo"], plans, primaryColor: "#000", accentColor: "#fc0", logoMode: "DEFAULT", customLogoUrl: "", compactMode: false,
});

const student = (plan: string, planId = ""): Student => ({
  id: "student-1", firstName: "Ana", lastName: "Pérez", phone: "111111", email: "", birthDate: "", weight: 0,
  height: 0, goal: "", plan, planId, monthlyFee: 100, joinedAt: "2026-01-01", dueDate: "", status: "activo",
  serviceType: "CLASSES", notes: "", studentType: "Adulto",
});

test("un plan libre guardado aparece en las opciones de Alumnos", () => {
  assert.deepEqual(studentPlanOptions(settings([{ id: "casa", name: "Plan casa", price: 25000 }])), [
    { id: "id:casa", persistentId: "casa", selectionKey: "id:casa", days: "id:casa", name: "Plan en casa", price: 25000, configured: true },
  ]);
});

test("los planes se ordenan de forma estable por nombre", () => {
  const options = studentPlanOptions(settings([{ id: "z", name: "Plan Z", price: 2 }, { id: "a", name: "Plan A", price: 1 }]));
  assert.deepEqual(options.map((plan) => plan.persistentId), ["a", "z"]);
});

test("las configuraciones antiguas no reciben un id persistente inventado", () => {
  assert.equal(plansWithIds([{ name: "Plan casa", price: 1 }])[0].id, "");
});

test("valida nombres vacíos, duplicados y precios negativos", () => {
  assert.match(validateCoachPlans([{ id: "a", name: "  ", price: 1 }]) ?? "", /nombre/);
  assert.match(validateCoachPlans([{ id: "a", name: "Plan Ágil", price: 1 }, { id: "b", name: "PLAN AGIL", price: 2 }]) ?? "", /repetido/);
  assert.match(validateCoachPlans([{ id: "a", name: "Plan", price: -1 }]) ?? "", /negativo/);
});

test("la normalización ignora espacios, tildes y mayúsculas", () => {
  assert.equal(normalizePlanName("  PLÁN Casa "), "plan en casa");
  assert.equal(normalizePlanName("2 días por semanas"), normalizePlanName("2 dias por semana"));
});

test("la asignación usa id y conserva compatibilidad por nombre", () => {
  const plans = plansWithIds([{ id: "casa", name: "Plan casa", price: 100 }]);
  assert.equal(assignedPlan(student("Nombre viejo", "casa"), plans)?.id, "casa");
  assert.equal(assignedPlan(student("plan CASA"), plans)?.id, "casa");
});

test("renombrar o cambiar precio sincroniza la ficha actual por id", () => {
  const current = plansWithIds([{ id: "casa", name: "Plan casa", price: 100 }]);
  const next = plansWithIds([{ id: "casa", name: "Plan hogar", price: 150 }]);
  const updated = synchronizedStudentPlan(student("Plan casa", "casa"), current, next);
  assert.equal(updated.plan, "Plan hogar");
  assert.equal(updated.monthlyFee, 150);
  assert.equal(updated.planId, "casa");
});

test("quitar un plan asignado se detecta y un plan libre se puede quitar", () => {
  const current = plansWithIds([{ id: "casa", name: "Plan casa", price: 100 }, { id: "gym", name: "Gimnasio", price: 200 }]);
  const withoutCasa = plansWithIds([{ id: "gym", name: "Gimnasio", price: 200 }]);
  assert.equal(removedAssignedPlan([student("Plan casa", "casa")], current, withoutCasa)?.plan.persistentId, "casa");
  assert.equal(removedAssignedPlan([student("Plan casa", "casa")], current, current), null);
});

test("Configuración usa claves estables y guarda solo al enviar", () => {
  const source = readFileSync("app/configuracion/page.tsx", "utf8");
  assert.match(source, /key=\{methodKeys\[index\]/);
  assert.match(source, /planSelectionKey\(plan\)/);
  assert.doesNotMatch(source, /key=\{`\$\{method\}-\$\{index\}`\}/);
  assert.doesNotMatch(source, /key=\{`\$\{plan\.name\}-\$\{index\}`\}/);
  assert.match(source, /onSubmit=\{submit\}/);
  assert.match(source, /await save\(\[value\]\)/);
});

test("Alumnos no reconstruye la lista fija de frecuencias", () => {
  const source = readFileSync("lib/student-enrollment.ts", "utf8");
  assert.doesNotMatch(source, /PLAN_DAYS/);
  assert.match(source, /return studentPlanOptions\(settings\)/);
  const page = readFileSync("app/alumnos/page.tsx", "utf8");
  assert.match(page, /cache: "no-store"/);
  assert.match(page, /value=\{form\.selectionKey\}/);
  assert.match(page, /<option value="">Seleccioná un plan mensual<\/option>/);
  assert.match(page, /selectedStudentPlanFormValue\(value, options\.plans\)/);
});

test("alumnos invitados CLASSES, PERSONALIZED y MIXED sincronizan selector y plan real al editar", () => {
  const options = studentPlanOptions(settings([{ id: "mensual", name: "Plan mensual", price: 30000 }]));
  for (const serviceType of ["CLASSES", "PERSONALIZED", "MIXED"] as const) {
    const invited = { ...student(""), serviceType, planId: "", monthlyFee: 0 };
    const initial = studentPlanFormValue(invited, options);
    assert.deepEqual(initial, { plan: "", planId: "", monthlyFee: 0, selectionKey: "" });

    const selected = selectedStudentPlanFormValue(options[0].selectionKey, options);
    assert.deepEqual(selected, { plan: "Plan mensual", planId: "mensual", monthlyFee: 30000, selectionKey: "id:mensual" });
    const payload = buildStudentEnrollmentPayload({ ...invited, ...selected });
    assert.equal(payload.serviceType, serviceType);
    assert.equal(payload.planId, "mensual");
    assert.equal(resolveStudentPlan(payload, options).status, "matched");
  }
});

test("un alumno manual conserva el plan asociado y la misma identidad al editar", () => {
  const options = studentPlanOptions(settings([{ id: "manual", name: "Personalizado", price: 50000 }]));
  const initial = studentPlanFormValue({ plan: "Personalizado", planId: "manual", monthlyFee: 50000 }, options);
  assert.deepEqual(initial, { plan: "Personalizado", planId: "manual", monthlyFee: 50000, selectionKey: "id:manual" });
  assert.equal(buildStudentEnrollmentPayload(initial).planId, "manual");
});

test("la sincronización no toca datos ajenos al plan", () => {
  const original = { ...student("Plan casa", "casa"), notes: "Historial intacto", dueDate: "2026-09-10" };
  const updated = synchronizedStudentPlan(original, plansWithIds([{ id: "casa", name: "Plan casa", price: 100 }]), plansWithIds([{ id: "casa", name: "Plan hogar", price: 200 }]));
  assert.equal(updated.notes, original.notes);
  assert.equal(updated.dueDate, original.dueDate);
});

test("un alumno legacy se resuelve por nombre canónico y precio sin enviar id sintético", () => {
  const options = studentPlanOptions(settings([{ name: "2 días por semanas", price: 25000 }]));
  const resolved = resolveStudentPlan({ plan: "2 dias por semana", planId: "legacy-plan-2-dias-1", monthlyFee: 25000 }, options);
  assert.equal(resolved.status, "matched");
  const payload = buildStudentEnrollmentPayload({ planId: options[0].id, selectionKey: options[0].selectionKey, plan: options[0].name });
  assert.equal(payload.planId, "");
  assert.equal("selectionKey" in payload, false);
});
