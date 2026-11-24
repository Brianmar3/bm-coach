const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { PGlite } = require("@electric-sql/pglite");

test("la migración conserva clases anteriores y ordena cada fecha por separado", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE group_class_plans (
        id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, date DATE NOT NULL,
        snapshot JSONB NOT NULL, "createdAt" TIMESTAMP NOT NULL
      );
      INSERT INTO group_class_plans VALUES
        ('a2','a','2026-11-24','{"name":"Funcional"}','2026-11-24 09:00'),
        ('a1','a','2026-11-24','{"name":"GAP"}','2026-11-24 08:00'),
        ('a3','a','2026-11-25','{"name":"Kids"}','2026-11-24 07:00'),
        ('b1','b','2026-11-24','{"name":"Otra"}','2026-11-24 06:00');
    `);
    await db.exec(readFileSync(join(__dirname, "../prisma/migrations/20261124120000_group_class_plan_order/migration.sql"), "utf8"));
    const initial = await db.query('SELECT id, "sortOrder", snapshot FROM group_class_plans ORDER BY "workspaceId", date, "sortOrder"');
    assert.deepEqual(initial.rows.map((row) => [row.id, row.sortOrder, row.snapshot.name]), [
      ["a1", 0, "GAP"], ["a2", 1, "Funcional"], ["a3", 0, "Kids"], ["b1", 0, "Otra"],
    ]);
    await db.exec('BEGIN; UPDATE group_class_plans SET "sortOrder"=1 WHERE id=\'a1\'; UPDATE group_class_plans SET "sortOrder"=0 WHERE id=\'a2\'; COMMIT;');
    const ordered = await db.query('SELECT id FROM group_class_plans WHERE "workspaceId"=\'a\' AND date=\'2026-11-24\' ORDER BY "sortOrder"');
    assert.deepEqual(ordered.rows.map((row) => row.id), ["a2", "a1"]);
    const other = await db.query('SELECT id, "sortOrder" FROM group_class_plans WHERE id IN (\'a3\',\'b1\') ORDER BY id');
    assert.deepEqual(other.rows.map((row) => row.sortOrder), [0, 0]);
  } finally { await db.close(); }
});
