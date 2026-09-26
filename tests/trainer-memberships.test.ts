import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { addUtcMonths, effectiveTrainerSubscriptionStatus, isSubscriptionPeriod, isSubscriptionPlan, isSubscriptionStatus, parseDateInput, validSubscriptionTimeline } from "../lib/trainer-subscription.ts";

const read = (path: string) => readFileSync(path, "utf8");
const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260917180000_trainer_subscriptions/migration.sql");
const membershipApi = read("app/api/platform/trainers/[id]/membership/route.ts");
const paidApi = read("app/api/platform/trainers/[id]/membership/mark-paid/route.ts");
const trainersApi = read("app/api/platform/trainers/route.ts");
const trainersUi = read("componentes/platform-trainers.tsx");
const membershipsUi = read("componentes/platform-memberships.tsx");
const managerUi = read("componentes/trainer-membership-manager.tsx");
const proxy = read("proxy.ts");
const adminApiAuth = read("lib/admin-api-auth.ts");
const dashboardApi = read("app/api/dashboard/route.ts");

test("modelo comercial es único por trainer y no depende del workspace", () => {
  assert.match(schema, /model TrainerSubscription \{/);
  assert.match(schema, /trainerUserId\s+String\s+@unique/);
  assert.match(schema, /trainer\s+User\s+@relation/);
  assert.doesNotMatch(schema.slice(schema.indexOf("model TrainerSubscription"), schema.indexOf("model TrainerInvitation")), /workspaceId/);
  assert.match(migration, /ON DELETE RESTRICT/);
});

test("planes y estados admiten sólo el catálogo comercial", () => {
  for (const plan of ["FREE", "STARTER", "PRO", "PREMIUM"]) assert.equal(isSubscriptionPlan(plan), true);
  for (const status of ["ACTIVE", "PAST_DUE", "SUSPENDED", "CANCELLED"]) assert.equal(isSubscriptionStatus(status), true);
  assert.equal(isSubscriptionPlan("ENTERPRISE"), false);
  assert.equal(isSubscriptionStatus("DELETED"), false);
});

test("estado efectivo muestra vencido sin mutar el estado persistido", () => {
  const now = new Date("2026-09-17T12:00:00Z");
  assert.equal(effectiveTrainerSubscriptionStatus({ status: "ACTIVE", nextDueAt: "2026-09-16T12:00:00Z" }, now), "PAST_DUE");
  assert.equal(effectiveTrainerSubscriptionStatus({ status: "ACTIVE", nextDueAt: "2026-09-18T12:00:00Z" }, now), "ACTIVE");
  assert.equal(effectiveTrainerSubscriptionStatus({ status: "SUSPENDED", nextDueAt: "2026-09-16T12:00:00Z" }, now), "SUSPENDED");
});

test("fechas comerciales se validan y los períodos no inventan duraciones", () => {
  const start = parseDateInput("2026-09-17")!;
  assert.equal(parseDateInput("17/09/2026"), undefined);
  assert.equal(validSubscriptionTimeline({ startedAt: start, lastPaidAt: start, currentPeriodEnd: parseDateInput("2026-10-17")!, nextDueAt: parseDateInput("2026-10-17")! }), true);
  assert.equal(validSubscriptionTimeline({ startedAt: start, lastPaidAt: parseDateInput("2026-09-16")!, currentPeriodEnd: null, nextDueAt: null }), false);
  for (const period of [1, 3, 6, 12]) assert.equal(isSubscriptionPeriod(period), true);
  assert.equal(addUtcMonths(new Date("2026-01-31T12:00:00Z"), 1).toISOString().slice(0, 10), "2026-02-28");
});

test("PLATFORM_OWNER puede leer, crear y actualizar la membresía de un trainer profesional", () => {
  assert.match(membershipApi, /platformOwnerApiAccess/);
  assert.match(membershipApi, /export async function GET/);
  assert.match(membershipApi, /export async function PATCH/);
  assert.match(membershipApi, /platformRole: "TRAINER"/);
  assert.match(membershipApi, /type: "PROFESSIONAL"/);
  assert.match(membershipApi, /trainerSubscription\.upsert/);
});

test("TRAINER normal recibe 403 mediante el guard compartido", () => {
  assert.match(membershipApi, /if \(!access\.ok\) return access\.response/);
  assert.match(read("lib/platform-auth.ts"), /status: 403/);
});

test("mark-paid exige período o fecha y renueva sin activar el usuario implícitamente", () => {
  assert.match(paidApi, /isSubscriptionPeriod/);
  assert.match(paidApi, /lastPaidAt: now/);
  assert.match(paidApi, /currentPeriodEnd: renewalDate/);
  assert.match(paidApi, /nextDueAt: renewalDate/);
  assert.match(paidApi, /status: "ACTIVE"/);
  assert.doesNotMatch(paidApi, /prisma\.user\.update/);
});

test("suspensión y reactivación sincronizan acceso en transacción sin tocar datos del workspace", () => {
  assert.match(membershipApi, /SUSPEND_ACCESS/);
  assert.match(membershipApi, /REACTIVATE_ACCESS/);
  assert.match(membershipApi, /prisma\.\$transaction/);
  assert.match(membershipApi, /status: "SUSPENDED"/);
  assert.match(membershipApi, /status: "ACTIVE"/);
  assert.doesNotMatch(membershipApi, /workspace\.(update|delete)|studentRecord\.(update|delete)|deleteMany/);
});

test("cancelar suspende acceso y conserva la membresía y sus relaciones", () => {
  assert.match(membershipApi, /status === "CANCELLED"/);
  assert.match(membershipApi, /data: \{ status: "SUSPENDED" \}/);
  assert.doesNotMatch(membershipApi, /trainerSubscription\.delete|user\.delete/);
});

test("listado soporta ausencia de membresía, filtros y acceso al detalle", () => {
  assert.match(trainersApi, /trainerSubscription: true/);
  assert.match(trainersUi, /Sin membresía/);
  for (const label of ["Todos", "Al día", "Vencidos", "Suspendidos", "Próximos a vencer"]) assert.match(trainersUi, new RegExp(label));
  assert.match(trainersUi, /\/platform\/trainers\/\$\{trainer\.id\}/);
  assert.match(managerUi, /Gestionar membresía|Configurar membresía/);
});

test("panel dedicado reutiliza contratos de pago, suspensión y reactivación", () => {
  for (const label of ["Todas", "Al día", "Vencidas", "Suspendidas", "Canceladas", "Próximas a vencer"]) assert.match(membershipsUi, new RegExp(label));
  assert.match(membershipsUi, /\/mark-paid/);
  assert.match(membershipsUi, /SUSPEND_ACCESS/);
  assert.match(membershipsUi, /REACTIVATE_ACCESS/);
});

test("modal mobile prioriza vencimiento, conserva fechas internas y espera guardado para cerrar", () => {
  assert.match(managerUi, /Período actual/);
  assert.match(managerUi, /<details[^>]*>[^]*Más información y fechas internas/);
  for (const field of ["startedAt", "lastPaidAt", "currentPeriodEnd", "nextDueAt"]) assert.match(managerUi, new RegExp(`name="${field}"`));
  assert.match(managerUi, /if \(busy\.current\) return/);
  assert.match(managerUi, /await onSaved\(message\)/);
  assert.match(managerUi, /Guardando\.\.\./);
  assert.match(managerUi, /catch \(cause\) \{ setError/);
  assert.match(read("componentes/platform-trainers.tsx"), /await load\(\); setManaging\(null\); setMembershipNotice\(message\)/);
  assert.match(read("componentes/platform-memberships.tsx"), /setMembershipNotice\(message\)/);
  assert.match(read("componentes/trainer-membership-detail-manager.tsx"), /setNotice\(message\)/);
});

test("una sesión de trainer suspendido se corta con 401 antes de llegar a las APIs operativas", () => {
  assert.match(proxy, /export async function proxy/);
  assert.match(proxy, /prisma\.user\.findUnique/);
  assert.match(proxy, /user\?\.status === "ACTIVE"/);
  assert.match(proxy, /adminSession\.ok && await sessionUserIsActive\(adminSession\.userId\)/);
  assert.match(proxy, /La cuenta no está activa\./);
  assert.match(proxy, /status: 401/);
  assert.doesNotMatch(proxy, /workspaceId|trainerSubscription/);
});

test("dashboard aplica el guard activo antes de resolver workspace y nunca convierte suspensión en 500", () => {
  assert.match(adminApiAuth, /prisma\.user\.findUnique/);
  assert.match(adminApiAuth, /user\.status !== "ACTIVE"/);
  assert.match(adminApiAuth, /status: 401/);
  assert.ok(dashboardApi.indexOf("requireAdminApiResponse()") < dashboardApi.indexOf("requireTrainerWorkspace()"));
});

test("el guard común conserva acceso de cuentas ACTIVE y no restringe PLATFORM_OWNER por rol", () => {
  assert.match(proxy, /if \(!await sessionUserIsActive\(session\.userId\)\)/);
  assert.doesNotMatch(proxy, /platformRole\s*!==/);
  assert.match(adminApiAuth, /return null/);
});
