import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { normalize, analyze, inventoryCsv, run } from "../scripts/audit-exercise-library-inventory.mjs";

const base = { id: "a", name: "dumbbell seated shoulder press", displayNameEs: "Press sentado", aliases: [], equipment: "dumbbell", targetMuscle: "delts", bodyPart: "shoulders", translationStatus: "AUTOMATIC", searchableText: "press sentado", instructionStepsEs: ["Empujá."], thumbnailPath: "images/a.jpg", gifPath: "videos/a.gif" };

test("normalización acotada: no confunde variaciones técnicas ni elimina plurales arbitrarios", () => {
  assert.equal(normalize("  MÁNCUERNAS--Press  "), "mancuerna press");
  assert.notEqual(normalize("press inclinado"), normalize("press declinado"));
  assert.notEqual(normalize("abs"), normalize("ab"));
});

test("nombres iguales son candidatos; variantes y aliases ambiguos no se fusionan", () => {
  const items = [base, { ...base, id: "b", name: "DUMBBELL SEATED SHOULDER-PRESS" }, { ...base, id: "c", name: "dumbbell standing shoulder press" }, { ...base, id: "d", name: "dumbbell shoulder rotation", aliases: ["Press sentado"] }];
  const before = JSON.stringify(items);
  const audit = analyze(items);
  assert.equal(audit.pairs.find(p => p.a.id === "a" && p.b.id === "b").classification, "DUPLICADO PROBABLE");
  assert.match(audit.pairs.find(p => p.a.id === "a" && p.b.id === "c").classification, /^VARIANTE/);
  assert.equal(audit.pairs.find(p => p.a.id === "a" && p.b.id === "d").classification, "REVISIÓN MANUAL");
  assert.equal(JSON.stringify(items), before);
  assert.equal(audit.muscles.reduce((sum, row) => sum + row.count, 0), items.length);
});

test("media es referencia, REVIEW es pendiente y CSV escapa comillas/separadores", () => {
  const items = [base, { ...base, id: "b", name: 'nombre, con "comillas"', translationStatus: "REVIEW", thumbnailPath: undefined, gifPath: undefined }];
  const audit = analyze(items);
  assert.deepEqual(audit.media, { images: 1, gifs: 1, none: 1 });
  assert.ok(audit.recommendations.some(row => row.item.id === "b" && row.reason === "translationStatus=REVIEW"));
  const csv = inventoryCsv(items);
  assert.match(csv, /"nombre, con ""comillas"""/);
  assert.match(csv, /NO_VERIFICADA/);
  assert.equal(csv.split("\r\n").length, 4);
});

test("genera sólo informes y es reproducible sin external, env ni base de datos", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "bm-library-audit-"));
  try {
    await mkdir(path.join(root, "data"));
    const input = JSON.stringify([base]);
    await writeFile(path.join(root, "data", "bm-exercise-library.json"), input);
    await writeFile(path.join(root, "data", "bm-exercise-library-custom.json"), "[]");
    await run(root);
    const csv = await readFile(path.join(root, "docs", "exercise-library-inventory.csv"), "utf8");
    const md = await readFile(path.join(root, "docs", "exercise-library-audit.md"), "utf8");
    await run(root);
    assert.equal(await readFile(path.join(root, "data", "bm-exercise-library.json"), "utf8"), input);
    assert.equal(await readFile(path.join(root, "docs", "exercise-library-inventory.csv"), "utf8"), csv);
    assert.equal(await readFile(path.join(root, "docs", "exercise-library-audit.md"), "utf8"), md);
  } finally { await rm(root, { recursive: true, force: true }); }
});
