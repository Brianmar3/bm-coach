const { test } = require("node:test");
const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { PGlite } = require("@electric-sql/pglite");
const { classNoteSnapshot } = require("../lib/group-class-planning.ts");

test("la copia de la clase conserva bloques y modalidad sin alterar el original", () => {
  const original = { name: "Funcional A", tags: ["Tipo de clase: Funcional"], days: [{ warmup: "", observations: "", blocks: [{ name: "Movilidad", instructions: "5 min suaves", order: 1 }, { name: "Circuito", instructions: "3 vueltas", order: 2 }] }] };
  const copy = classNoteSnapshot(original);
  copy.blocks[1].text = "4 vueltas";
  assert.equal(original.days[0].blocks[1].instructions, "3 vueltas");
  assert.equal(copy.modality, "Funcional");
});

test("migración aislada: planes reutilizados, variantes y dictado separados por workspace", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE TABLE training_routines (id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL);
      CREATE TABLE class_occurrences (
        id TEXT PRIMARY KEY, "workspaceId" TEXT NOT NULL, date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'SCHEDULED'
      );
      INSERT INTO training_routines VALUES ('funcional','espacio-a'), ('variante','espacio-a'), ('ajena','espacio-b');
      INSERT INTO class_occurrences VALUES
        ('lunes','espacio-a','2026-11-16','SCHEDULED'),
        ('martes','espacio-a','2026-11-17','SCHEDULED'),
        ('sin-dictar','espacio-a','2026-11-18','CANCELLED'),
        ('otro-alumno','espacio-b','2026-11-16','SCHEDULED');
    `);
    const migration = readFileSync(join(__dirname, "../prisma/migrations/20261117000000_group_class_planning/migration.sql"), "utf8");
    await db.exec(migration);
    const base = { name: "Funcional", modality: "Funcional", blocks: [{ name: "Circuito", text: "3 vueltas" }] };
    await db.query('UPDATE class_occurrences SET "plannedRoutineId"=$1, "plannedSnapshot"=$2 WHERE id IN ($3,$4) AND "workspaceId"=$5', ["funcional", JSON.stringify(base), "lunes", "martes", "espacio-a"]);
    await db.query('UPDATE class_occurrences SET "taughtAt"=NOW(), "taughtSnapshot"="plannedSnapshot", status=$1 WHERE id=$2 AND "workspaceId"=$3', ["COMPLETED", "lunes", "espacio-a"]);
    const variant = { ...base, name: "Funcional variante", blocks: [{ name: "Circuito", text: "4 vueltas" }] };
    await db.query('UPDATE class_occurrences SET "plannedRoutineId"=$1, "plannedSnapshot"=$2 WHERE id=$3 AND "workspaceId"=$4', ["variante", JSON.stringify(variant), "martes", "espacio-a"]);
    const result = await db.query('SELECT id, "plannedRoutineId", "plannedSnapshot", "taughtSnapshot", "taughtAt" FROM class_occurrences ORDER BY id');
    const rows = new Map(result.rows.map((row) => [row.id, row]));
    assert.equal(rows.get("lunes").taughtSnapshot.blocks[0].text, "3 vueltas");
    assert.equal(rows.get("martes").plannedSnapshot.blocks[0].text, "4 vueltas");
    assert.equal(rows.get("martes").taughtAt, null);
    assert.equal(rows.get("sin-dictar").taughtAt, null);
    assert.equal(rows.get("otro-alumno").plannedSnapshot, null);
    const index = await db.query("SELECT indexname FROM pg_indexes WHERE tablename='class_occurrences' AND indexname='class_occurrences_workspaceId_plannedRoutineId_idx'");
    assert.equal(index.rows.length, 1);
    await assert.rejects(db.query('UPDATE class_occurrences SET "plannedRoutineId"=$1 WHERE id=$2', ["missing", "martes"]), /foreign key/i);
    const still = await db.query('SELECT "plannedRoutineId" FROM class_occurrences WHERE id=$1', ["martes"]);
    assert.equal(still.rows[0].plannedRoutineId, "variante");
  } finally { await db.close(); }
});
