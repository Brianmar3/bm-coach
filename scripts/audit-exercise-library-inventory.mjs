import { readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { readExerciseCatalog, CUSTOM_FILE, findSimilarExercises } from "../lib/exercise-library-catalog.mjs";

// Analysis only: never used to rewrite names, IDs or the production search index.
export function normalize(value = "") {
  const equivalents = { mancuernas: "mancuerna", bandas: "banda", barras: "barra", piernas: "pierna", brazos: "brazo", bb: "barbell", db: "dumbbell", kb: "kettlebell", bw: "body weight" };
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).map(word => equivalents[word] ?? word).join(" ");
}
const names = item => [...new Set([item.name, item.displayNameEs, item.displayName, ...(item.aliases ?? [])].filter(Boolean).map(normalize))];
const qualifiers = /\b(one arm|single arm|one leg|single leg|two arms|two legs|alternat(?:e|ing)|incline|decline|seated|standing|lying|reverse|wide grip|close grip|neutral grip|behind neck|on knees)\b/g;
const stem = item => normalize(item.name).replace(qualifiers, " ").replace(/\s+/g, " ").trim();
const label = item => item.displayNameEs || item.displayName || item.name;
const countBy = (items, field, labelField) => [...items.reduce((map, item) => {
  const key = item[field] || "SIN_DATO";
  const row = map.get(key) ?? { key, label: item[labelField] || key, count: 0 };
  row.count++; map.set(key, row); return map;
}, new Map()).values()].sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));

export function analyze(items) {
  const pairs = [];
  const indexed = items.map(item => ({ item, names: new Set(names(item)), stem: stem(item), tokens: new Set(normalize(item.name).split(" ")) }));
  for (let i = 0; i < indexed.length; i++) for (let j = i + 1; j < indexed.length; j++) {
    const a = indexed[i], b = indexed[j];
    const exactOrigin = normalize(a.item.name) === normalize(b.item.name);
    const exactSpanish = normalize(label(a.item)) === normalize(label(b.item));
    const commonAliases = [...a.names].filter(name => b.names.has(name));
    const sameMovement = a.stem && a.stem === b.stem;
    const intersection = [...a.tokens].filter(token => b.tokens.has(token)).length;
    const similarity = intersection / (a.tokens.size + b.tokens.size - intersection);
    const similar = a.tokens.size >= 3 && b.tokens.size >= 3 && similarity >= 0.82;
    if (!exactOrigin && !exactSpanish && !commonAliases.length && !sameMovement && !similar) continue;
    const sameEquipment = a.item.equipment === b.item.equipment;
    const sameTarget = a.item.targetMuscle === b.item.targetMuscle;
    const qualifierDifference = !exactOrigin && sameMovement;
    const classification = qualifierDifference || (exactOrigin && !sameEquipment) ? "VARIANTE LEGÍTIMA (candidata)"
      : exactOrigin && sameEquipment && sameTarget ? "DUPLICADO PROBABLE" : "REVISIÓN MANUAL";
    const reasons = [exactOrigin && "nombre fuente normalizado igual", exactSpanish && "nombre español normalizado igual", commonAliases.length && `nombre/alias compartido: ${commonAliases.join("; ")}`, qualifierDifference && "mismo movimiento con posición/lateralidad/agarre distinto", !sameEquipment && "equipamiento distinto", !sameTarget && "músculo objetivo distinto", similar && `similitud de tokens ${(similarity * 100).toFixed(0)}%`].filter(Boolean);
    pairs.push({ a: a.item, b: b.item, classification, reasons });
  }
  const recommendations = [];
  for (const item of items) {
    if (item.translationStatus === "REVIEW") recommendations.push({ item, suggestion: "Revisar traducción y aliases españoles contra instrucciones; mantener el nombre fuente hasta validación humana.", reason: "translationStatus=REVIEW" });
    for (const alias of item.aliases ?? []) if (!normalize(item.searchableText).includes(normalize(alias))) recommendations.push({ item, suggestion: `Incluir en el índice el alias existente: ${alias}`, reason: "alias presente pero no localizable como frase normalizada" });
    const candidates = [ [/shoulder press/, "press militar"], [/romanian deadlift/, "RDL"], [/leg curl/, "curl femoral"] ];
    for (const [pattern, alias] of candidates) if (pattern.test(item.name) && !normalize(item.searchableText).includes(normalize(alias))) recommendations.push({ item, suggestion: `Considerar alias «${alias}»`, reason: `INFERENCIA: familia real «${item.name}»; confirmar técnica/variante antes de agregar` });
  }
  return { sources: { BASE: items.filter(item => item.source !== "BM_CUSTOM").length, BM_CUSTOM: items.filter(item => item.source === "BM_CUSTOM").length, TOTAL: items.length }, crossSourceSimilarities: items.filter(item => item.source === "BM_CUSTOM").flatMap(item => findSimilarExercises(item, items.filter(other => other.source !== "BM_CUSTOM")).map(match => ({ customId: item.id, ...match }))), total: items.length, uniqueIds: new Set(items.map(item => item.id)).size, muscles: countBy(items, "targetMuscle", "targetMuscleLabelEs"), equipment: countBy(items, "equipment", "equipmentLabelEs"), bodyParts: countBy(items, "bodyPart", "bodyPartLabelEs"), pairs, recommendations,
    media: { images: items.filter(item => Boolean(item.thumbnailPath)).length, gifs: items.filter(item => Boolean(item.gifPath)).length, none: items.filter(item => !item.thumbnailPath && !item.gifPath).length },
  };
}

const csvCell = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
export function inventoryCsv(items) {
  const fields = ["id", "sourceId", "displayNameEs", "name", "aliases", "bodyPart", "bodyPartLabelEs", "targetMuscle", "targetMuscleLabelEs", "secondaryMuscles", "secondaryMusclesEs", "muscleGroup", "muscleGroupLabelEs", "equipment", "equipmentLabelEs", "translationStatus", "translationPass", "source", "instructionsAvailable", "instructionStepsCount", "thumbnailReferenced", "thumbnailPath", "gifReferenced", "gifPath", "physicalMediaAvailability", "attribution"];
  return fields.map(csvCell).join(",") + "\r\n" + items.map(item => {
    const row = { ...item, instructionsAvailable: Boolean(item.instructionsEs || item.instructionStepsEs?.length), instructionStepsCount: item.instructionStepsEs?.length ?? 0, thumbnailReferenced: Boolean(item.thumbnailPath), gifReferenced: Boolean(item.gifPath), physicalMediaAvailability: "NO_VERIFICADA" };
    return fields.map(field => csvCell(Array.isArray(row[field]) ? JSON.stringify(row[field]) : row[field])).join(",");
  }).join("\r\n") + "\r\n";
}
const escapeMd = value => String(value).replaceAll("|", "\\|").replace(/\r?\n/g, " ");
const table = (headers, rows) => [headers, headers.map(() => "---"), ...rows].map(row => `| ${row.map(escapeMd).join(" | ")} |`).join("\n");
const equipmentFamilies = {
  "Peso corporal": ["body weight"], Barra: ["barbell", "olympic barbell", "ez barbell", "trap bar"], Mancuernas: ["dumbbell"], Kettlebell: ["kettlebell"], Polea: ["cable"],
  "Máquina (fuerza)": ["leverage machine", "smith machine", "sled machine"], Bandas: ["band", "resistance band"], "TRX / suspensión": ["suspension", "trx"], "Balón medicinal": ["medicine ball"], Landmine: ["landmine"],
};
export function markdownReport(items, audit, hash) {
  const distribution = rows => table(["Categoría", "Valor fuente", "Cantidad"], rows.map(row => [row.label, row.key, row.count]));
  const pairTable = rows => rows.length ? table(["Ejercicio A", "Ejercicio B", "Clasificación", "Motivo"], rows.map(p => [`${p.a.id} [${p.a.source ?? "BASE"}] · ${label(p.a)}`, `${p.b.id} [${p.b.source ?? "BASE"}] · ${label(p.b)}`, p.classification, p.reasons.join("; ")])) : "No se detectaron candidatos con estos criterios.";
  const families = Object.entries(equipmentFamilies);
  const represented = new Set(families.flatMap(([, values]) => values));
  const matrix = audit.muscles.map(muscle => [muscle.label, muscle.count, ...families.map(([, values]) => items.filter(item => item.targetMuscle === muscle.key && values.includes(item.equipment)).length)]);
  const rare = audit.muscles.filter(row => row.count <= 6);
  const lowCells = audit.muscles.filter(row => row.count >= 25).flatMap(muscle => families.slice(0, 7).map(([family, values]) => ({ muscle, family, count: items.filter(item => item.targetMuscle === muscle.key && values.includes(item.equipment)).length }))).filter(row => row.count <= 2);
  const probable = audit.pairs.filter(pair => pair.classification === "DUPLICADO PROBABLE");
  const variants = audit.pairs.filter(pair => pair.classification.startsWith("VARIANTE"));
  const review = audit.pairs.filter(pair => pair.classification === "REVISIÓN MANUAL");
  return `# Auditoría de Biblioteca BM Training

## 1. Fuente real y reproducibilidad

- Fuentes: data/bm-exercise-library.json + data/bm-exercise-library-custom.json. SHA-256 conjunto: ${hash}.
- BASE: **${audit.sources.BASE}**; BM CUSTOM: **${audit.sources.BM_CUSTOM}**; TOTAL: **${audit.sources.TOTAL}**.
- Total: **${audit.total}** registros; **${audit.uniqueIds}** IDs distintos.
- Fuente del importador: external/exercises-dataset-main/data/exercises.json (opcional para importar; no se leyó /external/ en esta auditoría).
- scripts/build-exercise-library.mjs + lib/exercise-library-transform.mjs generan el catálogo y el reporte de traducción. lib/exercise-library-server.ts ensambla base + BM CUSTOM en runtime; los tests usan un fixture versionado.
- Se puede editar intencionalmente data/exercise-localization-es.json (reglas, excepciones, aliases) y regenerar con la fuente disponible. NO editar manualmente el catálogo generado: el rebuild lo reemplaza. Los informes presentes también son generados.
- Ejecutar npm run exercise-library:audit. Sólo escribe este informe y exercise-library-inventory.csv; sin DB, red, descargas, importación ni modificaciones del catálogo. El script previo scripts/audit-exercise-library.mjs queda intacto: realiza otra auditoría contra datos de DB y genera reports/exercise-library-audit.json.

## 2. Distribución por músculo objetivo

${distribution(audit.muscles)}

## 3. Distribución por parte corporal

${distribution(audit.bodyParts)}

## 4. Distribución por equipamiento

${distribution(audit.equipment)}

### Familias agrupadas para análisis

${table(["Familia", "Valores exactos incluidos", "Cantidad"], [...families.map(([family, values]) => [family, values.join(", "), items.filter(item => values.includes(item.equipment)).length]), ["Otros", "resto de valores fuente", items.filter(item => !represented.has(item.equipment)).length]])}

Una cantidad cero significa ausencia de esa etiqueta de equipamiento; no demuestra ausencia de un movimiento. Landmine aparece en ${items.filter(item => /landmine/i.test(item.name)).length} nombres (INFERENCIA), aunque puede estar etiquetado como barra. No inferir TRX a partir de assisted o rope.

## 5. Posibles duplicados

${probable.length} pares DUPLICADO PROBABLE; ${variants.length} pares de variantes candidatas; ${review.length} pares que requieren revisión manual. Un ejercicio puede participar en varios pares; NO son cantidades de ejercicios eliminables. Se compara todo el catálogo, sin truncar resultados.

Normalización exclusiva del análisis: caja, tildes, puntuación, espacios y equivalencias acotadas (mancuernas/mancuerna, bandas/banda, barras/barra, piernas/pierna, brazos/brazo y abreviaturas BB/DB/KB/BW). No se quitan plurales indiscriminadamente. DUPLICADO PROBABLE exige nombre fuente normalizado, equipamiento y objetivo iguales; traducciones o aliases compartidos por sí solos se revisan manualmente. Coincidencia de nombres/aliases, similitud Jaccard de tokens >=82% y una lista explícita de calificadores de postura/agarre/lateralidad generan candidatos. Las coincidencias son heurísticas, nunca prueba de identidad técnica ni autorización para fusionar.

### Duplicados probables

${pairTable(probable)}

### Variantes legítimas detectadas (candidatas)

Se conserva la diferencia explícita de postura, agarre, lateralidad o equipo. Validar instrucciones y técnica antes de confirmar esta clasificación.

${pairTable(variants)}

### Similitudes / traducciones ambiguas para revisión manual

${pairTable(review)}

## 6. Aliases o traducciones recomendadas

${audit.recommendations.length} observaciones. No se agregó ningún alias. REVIEW no habilita traducir por conjetura. «Press militar» es una sugerencia de familia que necesita revisión, no una equivalencia universal para todos los shoulder press.

${table(["ID y ejercicio", "Motivo", "Recomendación"], audit.recommendations.map(row => [`${row.item.id} · ${label(row.item)}`, row.reason, row.suggestion]))}

## 7. Categorías con poca cobertura

Se contabiliza músculo objetivo, no todos los músculos trabajados. Las categorías pequeñas pueden ser anatómicamente específicas; el conteo no mide calidad ni prueba que falte un ejercicio necesario.

Músculos con <=6 registros como objetivo: ${rare.map(row => `${row.label}: ${row.count}`).join("; ")}.

### Matriz músculo / equipo

${table(["Músculo", "Total", ...families.map(([family]) => family)], matrix)}

### Cruces con <=2 candidatos en músculos con >=25 registros

${table(["Músculo", "Familia", "Cantidad"], lowCells.map(row => [row.muscle.label, row.family, row.count]))}

Lateralidad no existe como campo del modelo. Nombres fuente con one/single arm/leg: ${items.filter(item => /\b(one|single)[ -](arm|leg)\b/i.test(item.name)).length} (INFERENCIA textual, no clasificación exhaustiva). No se concluye bilateral por ausencia de esas palabras.

## 8. Multimedia e instrucciones

- Con referencia de imagen: ${audit.media.images}; sin referencia: ${audit.total - audit.media.images}.
- Con referencia de GIF: ${audit.media.gifs}; sin referencia: ${audit.total - audit.media.gifs}.
- Sin referencia multimedia de ningún tipo: ${audit.media.none}.
- Con instrucciones/texto o pasos: ${items.filter(item => item.instructionsEs || item.instructionStepsEs?.length).length}.
- Disponibilidad física y en producción: **NO VERIFICADA**. No se accedió a /external/, ni se descargaron medios. En producción el proveedor local está deshabilitado por defecto; una ruta en JSON no garantiza un archivo accesible ni derechos de redistribución. Consultar docs/exercise-library-media.md.

## 9. Fuente propia BM implementada

La fuente versionada data/bm-exercise-library-custom.json es independiente del importador. lib/exercise-library-catalog.mjs valida esquema e IDs bm:<UUID> y ensambla ambas fuentes sin escribir sobre ellas. El producto usa loadExerciseLibrary(); búsqueda, filtros y referencias de Rutinas no distinguen el origen.

npm run exercise-library:add -- --input <archivo.json> valida y muestra similares en ambas fuentes. Agregar --write persiste sólo un alta válida. Las advertencias son para revisión humana, no bloquean variantes. Consultar docs/bm-custom-exercises.md. El rebuild externo sólo reemplaza la base.

### Similares entre BASE y BM CUSTOM (helper de altas)

${audit.crossSourceSimilarities.length ? table(["BM ID", "BASE ID", "Coincidencia", "Similitud", "Diferencias"], audit.crossSourceSimilarities.map(row => [row.customId, row.id, row.match, row.score.toFixed(3), row.differences.join("; ")])) : "Sin coincidencias entre fuentes."}

`;
}

export async function run(root = process.cwd()) {
  const input = path.join(root, "data", "bm-exercise-library.json");
  const source = Buffer.concat(await Promise.all([input, path.join(root, "data", CUSTOM_FILE)].map(file => readFile(file))));
  const { items } = await readExerciseCatalog(root);
  const audit = analyze(items);
  const hash = createHash("sha256").update(source).digest("hex");
  await mkdir(path.join(root, "docs"), { recursive: true });
  await writeFile(path.join(root, "docs", "exercise-library-inventory.csv"), inventoryCsv(items), "utf8");
  await writeFile(path.join(root, "docs", "exercise-library-audit.md"), markdownReport(items, audit, hash), "utf8");
  const after = createHash("sha256").update(Buffer.concat(await Promise.all([input, path.join(root, "data", CUSTOM_FILE)].map(file => readFile(file))))).digest("hex");
  if (after !== hash) throw new Error("El catálogo cambió durante la auditoría.");
  console.log(JSON.stringify({ sources: audit.sources, crossSourceSimilarities: audit.crossSourceSimilarities, total: audit.total, uniqueIds: audit.uniqueIds, pairs: Object.fromEntries([...new Set(audit.pairs.map(p => p.classification))].map(key => [key, audit.pairs.filter(p => p.classification === key).length])), recommendations: audit.recommendations.length, mediaReferences: audit.media, catalogSha256: hash, outputs: ["docs/exercise-library-inventory.csv", "docs/exercise-library-audit.md"] }, null, 2));
  return audit;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) await run();
