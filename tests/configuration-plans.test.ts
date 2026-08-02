import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assignedPlan, normalizePlanName, plansWithIds, removedAssignedPlan, studentPlanOptions,
  synchronizedStudentPlan, validateCoachPlans,
} from "../lib/coach-plans.ts";
import type { CoachSettings, Student } from "../types/gestion.ts";

const settings = (plans: CoachSettings["plans"]): CoachSettings => ({
  id: "main", systemName: "BM", coachName: "", phone: "", email: "", address: "", currency: "ARS",
  dueDay: 10, paymentMethods: ["Efectivo"], plans, primaryColor: "#000", accentColor: "#fc0", compactMode: false,
});

const student = (plan: string, planId = ""): Student => ({
  id: "student-1", firstName: "Ana", lastName: "Pérez", phone: "111111", email: "", birthDate: "", weight: 0,
  height: 0, goal: "", plan, planId, monthlyFee: 100, joinedAt: "2026-01-01", dueDate: "", status: "activo",
  serviceType: "CLASSES", notes: "", studentType: "Adulto",
});

test("un plan libre guardado aparece en las opciones de Alumnos", () => {
  assert.deepEqual(studentPlanOptions(settings([{ id: "casa", name: "Plan casa", price: 25000 }])), [
    { id: "casa", days: "casa", name: "Plan casa", price: 25000, configured: true },
  ]);
});

test("los planes se ordenan de forma estable por nombre", () => {
  const options = studentPlanOptions(settings([{ id: "z", name: "Plan Z", price: 2 }, { id: "a", name: "Plan A", price: 1 }]));
  assert.deepEqual(options.map((plan) => plan.id), ["a", "z"]);
});

test("las configuraciones antiguas reciben un id determinista", () => {
  assert.equal(plansWithIds([{ name: "Plan casa", price: 1 }])[0].id, "legacy-plan-plan-casa-1");
});

test("valida nombres vacíos, duplicados y precios negativos", () => {
  assert.match(validateCoachPlans([{ id: "a", name: "  ", price: 1 }]) ?? "", /nombre/);
  assert.match(validateCoachPlans([{ id: "a", name: "Plan Ágil", price: 1 }, { id: "b", name: "PLAN AGIL", price: 2 }]) ?? "", /repetido/);
  assert.match(validateCoachPlans([{ id: "a", name: "Plan", price: -1 }]) ?? "", /negativo/);
});

test("la normalización ignora espacios, tildes y mayúsculas", () => {
  assert.equal(normalizePlanName("  PLÁN Casa "), "plan casa");
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
  assert.equal(removedAssignedPlan([student("Plan casa", "casa")], current, withoutCasa)?.plan.id, "casa");
  assert.equal(removedAssignedPlan([student("Plan casa", "casa")], current, current), null);
});

test("Configuración usa claves estables y guarda solo al enviar", () => {
  const source = readFileSync("app/configuracion/page.tsx", "utf8");
  assert.match(source, /key=\{methodKeys\[index\]/);
  assert.match(source, /key=\{planId\(plan, index\)\}/);
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
  assert.match(page, /planId: selected\?\.id/);
});

test("la sincronización no toca datos ajenos al plan", () => {
  const original = { ...student("Plan casa", "casa"), notes: "Historial intacto", dueDate: "2026-09-10" };
  const updated = synchronizedStudentPlan(original, plansWithIds([{ id: "casa", name: "Plan casa", price: 100 }]), plansWithIds([{ id: "casa", name: "Plan hogar", price: 200 }]));
  assert.equal(updated.notes, original.notes);
  assert.equal(updated.dueDate, original.dueDate);
});
