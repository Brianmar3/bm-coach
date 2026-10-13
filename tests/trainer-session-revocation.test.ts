import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { authSessionExpiresAt } from "../lib/session-persistence.ts";
import { trainerSessionIsCurrent } from "../lib/trainer-session-revocation.ts";

test("reset invalida sesiones viejas de A pero conserva sesiones nuevas y las de B", async () => {
  const resetAt = new Date("2026-10-13T10:00:00Z");
  const store = { trainerPasswordResetToken: { findFirst: async ({ where }: { where: { trainerUserId: string; usedAt: { gte: Date } } }) => where.trainerUserId === "a" && resetAt >= where.usedAt.gte ? { id: "reset-a" } : null } };
  assert.equal(await trainerSessionIsCurrent("a", authSessionExpiresAt(new Date("2026-10-13T09:59:59Z")), store), false);
  assert.equal(await trainerSessionIsCurrent("a", authSessionExpiresAt(new Date("2026-10-13T10:00:01Z")), store), true);
  assert.equal(await trainerSessionIsCurrent("b", authSessionExpiresAt(new Date("2026-10-13T09:59:59Z")), store), true);
});

test("sin reset consumido no revoca y no permite fecha de sesión inválida", async () => {
  let queries = 0;
  const store = { trainerPasswordResetToken: { findFirst: async () => { queries++; return null; } } };
  assert.equal(await trainerSessionIsCurrent("a", authSessionExpiresAt(), store), true);
  assert.equal(await trainerSessionIsCurrent("a", new Date(NaN), store), false);
  assert.equal(queries, 1);
});

test("revocación se verifica en proxy, autorización de API, workspace y consulta de sesión", () => {
  for (const file of ["proxy.ts", "lib/admin-api-auth.ts", "lib/trainer-workspace.ts", "app/api/admin/auth/session/route.ts"]) assert.match(readFileSync(file, "utf8"), /await trainerSessionIsCurrent/);
});
