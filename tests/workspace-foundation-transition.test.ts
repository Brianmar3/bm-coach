import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const expand = readFileSync("prisma/migrations/20260909120000_workspace_foundation/migration.sql", "utf8");
const contract = readFileSync("prisma/migrations/20260916104324_workspace_foundation_contract/migration.sql", "utf8");
const schema = readFileSync("prisma/schema.prisma", "utf8");
const verifier = readFileSync("scripts/verify-workspace-foundation.mjs", "utf8");
const backfill = readFileSync("scripts/workspace-foundation-core.mjs", "utf8");

const legacyIndexes = [
  "trainer_push_subscriptions_endpoint_key",
  "trainer_notifications_eventKey_key",
  "training_library_folders_normalizedName_key",
  "training_library_tags_normalizedName_key",
  "monthly_summaries_year_month_key",
];

test("1. EXPAND acepta escrituras legacy y conserva sus contratos", () => {
  assert.doesNotMatch(expand, /DROP\s+(?:INDEX|CONSTRAINT)|SET\s+NOT\s+NULL/i);
  for (const index of legacyIndexes) assert.doesNotMatch(expand, new RegExp(`DROP INDEX "${index}"`));
  assert.match(expand, /ALTER TABLE "students" ADD COLUMN "workspaceId" TEXT;/);
  assert.match(expand, /"scope" "WorkspaceContentScope" NOT NULL DEFAULT 'WORKSPACE'/);
});

test("2. la app workspace-aware escribe workspaceId en nuevos registros", () => {
  for (const file of [
    "app/api/alumnos/route.ts",
    "app/api/admin/push/route.ts",
    "app/api/training-library/folders/route.ts",
    "lib/monthly-summary.ts",
    "lib/trainer-notifications.ts",
  ]) {
    assert.match(readFileSync(file, "utf8"), /workspaceId/);
  }
});

test("3. las lecturas nuevas resuelven y filtran el workspace", () => {
  for (const file of [
    "app/api/dashboard/route.ts",
    "app/api/admin/notifications/route.ts",
    "app/api/admin/push/diagnostics/route.ts",
    "app/api/resumen-mensual/route.ts",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /requireTrainerWorkspace/);
    assert.match(source, /workspaceId/);
  }
});

test("4. el backfill sólo completa ownership legacy nulo y es idempotente", () => {
  assert.match(backfill, /workspaceId: null/g);
  assert.match(backfill, /updateMany/g);
  assert.doesNotMatch(backfill, /deleteMany|delete\(/);
  assert.match(backfill, /workspace\.upsert/);
  assert.match(backfill, /workspaceMembership\.upsert/);
});

test("5. el verifier exige cero ownership pendiente después del backfill", () => {
  assert.match(verifier, /--phase=expand/);
  assert.match(verifier, /--phase=contract/);
  assert.match(verifier, /operationalRootsAssigned/);
  assert.match(verifier, /privateContentAssigned/);
  assert.match(verifier, /noCrossWorkspaceRelations/);
  assert.match(verifier, /Object\.values\(checks\)\.some/);
});

test("6. CONTRACT tiene preflight antes de endurecer o eliminar contratos legacy", () => {
  const preflight = contract.indexOf("DO $$");
  const notNull = contract.indexOf("SET NOT NULL");
  const firstDrop = contract.indexOf("DROP INDEX");
  assert.ok(preflight >= 0 && preflight < notNull && notNull < firstDrop);
  assert.match(contract, /WHERE "workspaceId" IS NULL/);
  assert.match(contract, /RAISE EXCEPTION/);
  assert.match(contract, /BEGIN;[\s\S]*COMMIT;/);
  for (const index of legacyIndexes) assert.match(contract.slice(0, notNull), new RegExp(index));
});

test("7. Push conserva deduplicación legacy y agrega identidad por workspace", () => {
  assert.doesNotMatch(expand, /DROP INDEX "trainer_push_subscriptions_endpoint_key"/);
  assert.match(expand, /trainer_push_subscriptions_workspaceId_endpoint_key/);
  assert.match(readFileSync("app/api/admin/push/route.ts", "utf8"), /workspaceId_endpoint/);
});

test("8. notifications mantienen dedupe legacy y aislamiento de inbox", () => {
  assert.doesNotMatch(expand, /DROP INDEX "trainer_notifications_eventKey_key"/);
  assert.match(expand, /trainer_notifications_workspaceId_eventKey_key/);
  const route = readFileSync("app/api/admin/notifications/route.ts", "utf8");
  assert.match(route, /requireTrainerWorkspace/);
  assert.match(route, /workspaceId/);
});

test("9. library conserva uniques antiguos durante EXPAND y usa scope definitivo", () => {
  for (const index of ["training_library_folders_normalizedName_key", "training_library_tags_normalizedName_key"]) {
    assert.doesNotMatch(expand, new RegExp(`DROP INDEX "${index}"`));
    assert.match(contract, new RegExp(`DROP INDEX "${index}"`));
  }
  assert.match(schema, /enum WorkspaceContentScope \{[\s\S]*GLOBAL[\s\S]*WORKSPACE/);
  assert.match(readFileSync("app/api/training-library/blocks/route.ts", "utf8"), /workspaceId_normalizedName/);
});

test("10. resumen mensual conserva el contrato viejo y calcula por workspace", () => {
  assert.doesNotMatch(expand, /DROP INDEX "monthly_summaries_year_month_key"/);
  assert.match(expand, /monthly_summaries_workspaceId_year_month_key/);
  assert.match(contract, /DROP INDEX "monthly_summaries_year_month_key"/);
  const summary = readFileSync("lib/monthly-summary.ts", "utf8");
  assert.match(summary, /workspaceId_year_month/);
  assert.match(summary, /workspaceId/);
});
