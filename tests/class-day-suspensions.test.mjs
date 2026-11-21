import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("la suspensión es única por entrenador y fecha, y reactivarla conserva los datos", async () => {
  const db = new PGlite();
  try {
    await db.exec('CREATE TABLE workspaces (id TEXT PRIMARY KEY); CREATE TABLE weekly_class_schedules (id TEXT PRIMARY KEY, "workspaceId" TEXT); CREATE TABLE class_occurrence_attendances (id TEXT PRIMARY KEY);');
    await db.exec(readFileSync(new URL("../prisma/migrations/20261120230000_class_day_suspensions/migration.sql", import.meta.url), "utf8"));
    await db.exec("INSERT INTO workspaces VALUES ('coach-a'), ('coach-b'); INSERT INTO weekly_class_schedules VALUES ('monday', 'coach-a'); INSERT INTO class_occurrence_attendances VALUES ('historical');");
    await db.query('INSERT INTO class_day_suspensions ("workspaceId", date) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['coach-a', '2026-11-23']);
    await db.query('INSERT INTO class_day_suspensions ("workspaceId", date) VALUES ($1, $2) ON CONFLICT DO NOTHING', ['coach-a', '2026-11-23']);
    assert.equal((await db.query('SELECT * FROM class_day_suspensions WHERE "workspaceId" = $1', ['coach-a'])).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM class_day_suspensions WHERE "workspaceId" = $1', ['coach-b'])).rows.length, 0);
    await db.query('DELETE FROM class_day_suspensions WHERE "workspaceId" = $1 AND date = $2', ['coach-a', '2026-11-23']);
    assert.equal((await db.query('SELECT * FROM class_day_suspensions')).rows.length, 0);
    assert.equal((await db.query('SELECT * FROM weekly_class_schedules')).rows.length, 1);
    assert.equal((await db.query('SELECT * FROM class_occurrence_attendances')).rows.length, 1);
  } finally { await db.close(); }
});
