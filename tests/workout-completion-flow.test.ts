import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const portal = readFileSync(new URL("../componentes/portal-section.tsx", import.meta.url), "utf8");
const api = readFileSync(new URL("../app/api/portal/entrenamientos/route.ts", import.meta.url), "utf8");
const completionFlow = portal.slice(portal.indexOf("function WorkoutView"), portal.indexOf("function WorkoutHistoryView"));

test("el cierre exitoso envía y conserva el estado finalizado", () => {
  assert.match(completionFlow, /status: finalize \? "finalizado" as const : "en_progreso" as const/);
  assert.match(completionFlow, /if \(finalize\) \{/);
  assert.match(completionFlow, /setCompletionSuccess\(true\)/);
});

test("finalizar cancela autosave pendiente y bloquea nuevas ejecuciones", () => {
  assert.match(completionFlow, /sessionFinalizingRef\.current = true;\s*autosaveAbortRef\.current\?\.abort\(\)/);
  assert.match(completionFlow, /if \(sessionFinalizingRef\.current\) return;/);
  assert.match(completionFlow, /sessionFinalizingRef\.current \|\| !started/);
  assert.ok((completionFlow.match(/if \(!draft \|\| sessionFinalizingRef\.current\) return;/g) ?? []).length >= 3);
});

test("el éxito no reconstruye un borrador desde datos obsoletos", () => {
  assert.match(completionFlow, /if \(completionSuccess \|\| draft \|\| !selectedDayId\) return;/);
  assert.match(completionFlow, /\[completionSuccess, data\.profile\.id, draft, selectedDayId\]/);
});

test("el cierre limpia errores y muestra un único feedback de éxito", () => {
  assert.match(completionFlow, /setError\(""\);\s*setMessage\(""\);\s*setCompletionSuccess\(true\)/);
  assert.equal((completionFlow.match(/Entrenamiento guardado correctamente/g) ?? []).length, 1);
  assert.doesNotMatch(completionFlow, /Tu entrenamiento se guardó con éxito|Entrenamiento cargado correctamente/);
});

test("un error real de cierre vuelve a habilitar el flujo y se informa", () => {
  assert.match(completionFlow, /if \(finalize\) sessionFinalizingRef\.current = false;/);
  assert.match(completionFlow, /setError\(value instanceof Error \? value\.message/);
});

test("la protección backend de sesiones finalizadas permanece intacta", () => {
  assert.match(api, /existingSession\?\.status === "COMPLETED"/);
  assert.match(api, /Una sesión finalizada no puede modificarse ni reabrirse/);
  assert.match(api, /if \(existing\.status === "COMPLETED"\) throw new Error\("COMPLETED_SESSION"\)/);
});
