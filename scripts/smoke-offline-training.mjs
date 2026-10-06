// Local production smoke test. Uses a synthetic student and mocked APIs; never touches a database.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
const runtime = process.env.BM_TEST_NODE_MODULES;
if (!runtime) throw new Error("Set BM_TEST_NODE_MODULES to the bundled Node packages directory.");
const { chromium } = createRequire(path.join(runtime, "playwright", "package.json"))("playwright");
const origin = process.env.BM_TEST_ORIGIN || "http://localhost:3101";
function fixture(serviceType) {
  const now = new Date(); const savedAt = now.toISOString();
  const exercise = { id: "exercise-a", name: "Sentadilla offline", muscleGroup: "Piernas", sets: 1, repetitions: "10", weight: 20, effortType: "RIR", effortValue: 2, restSeconds: 60, observations: "Controlá el descenso", videoUrl: "", tempo: "", alternativeExercise: "", equipment: "", optional: false, blockId: "block-a", targetType: "REPS", targetSeconds: null, targetRepetitions: "10", targetDistance: "", targetSide: "", order: 1 };
  const block = { id: "block-a", name: "Fuerza", type: "STRENGTH", order: 1, rounds: null, durationSeconds: null, workSeconds: null, restSeconds: null, restBetweenRoundsSeconds: null, targetRounds: null, instructions: "", exercises: [exercise] };
  const day = { id: "day-a", dayNumber: 1, name: "Piernas", objective: "Fuerza", warmup: "Movilidad suave", observations: "", estimatedMinutes: 30, blocks: [block], exercises: [exercise] };
  const routine = { id: "routine-a", name: "Programa original", objective: "Fuerza", level: "intermedio", status: "activa", kind: "assigned", description: "", location: "Gimnasio", equipment: [], tags: [], startDate: savedAt.slice(0, 10), durationWeeks: null, priorityMuscles: [], createdAt: savedAt, updatedAt: savedAt, archivedAt: "", studentIds: [], students: [], historicalStudents: [], days: [day, { ...day, id: "day-b", dayNumber: 2, name: "Segundo día", blocks: [{ ...block, id: "block-b" }] }] };
  return { version: 1, scope: JSON.stringify(["workspace-a", "student-a", "session-a"]), studentId: "student-a", workspaceId: "workspace-a", sessionId: "session-a", savedAt, expiresAt: new Date(now.getTime() + 7 * 86400000).toISOString(), proof: "synthetic-proof", branding: { accentColor: "#22C55E", logoMode: "DEFAULT", customLogoUrl: "", displayName: "Workspace prueba", isPremium: true, platformFallbackName: "BM Training" }, data: { profile: { id: "student-a", serviceType }, routine, workoutSessions: [], exerciseMediaEnabled: false } };
}
async function readRecords(page) {
  return page.evaluate(() => new Promise((resolve, reject) => { const request = indexedDB.open("bm-training-offline-v1", 1); request.onsuccess = () => { const db = request.result; const tx = db.transaction("records"); const get = tx.objectStore("records").getAll(); get.onsuccess = () => resolve(get.result); tx.oncomplete = () => db.close(); }; request.onerror = () => reject(request.error); }));
}
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    for (const serviceType of ["PERSONALIZED", "MIXED"]) {
      const context = await browser.newContext({ viewport: { width: 393, height: 851 }, serviceWorkers: "allow" });
      if (serviceType === "MIXED") await context.addInitScript(() => localStorage.setItem("bm-appearance-v1", "light"));
      let snapshot = fixture(serviceType); let rejectSave = true; const persisted = new Map(); let account = "student-a";
      await context.route("**/api/portal/**", async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === "/api/portal/session") return route.fulfill({ json: { offlineIdentity: { studentId: account, workspaceId: "workspace-a", sessionId: "session-a" } } });
        if (url.pathname === "/api/portal/offline") return route.fulfill({ json: snapshot });
        if (url.pathname === "/api/portal/entrenamientos") {
          if (rejectSave) return route.fulfill({ status: 503, json: { error: "Fallo simulado; registros conservados" } });
          const input = route.request().postDataJSON(); persisted.set(input.offline.clientSessionId, input);
          return route.fulfill({ json: { id: "server-a", status: input.status } });
        }
        return route.fulfill({ status: 401, json: { error: "Synthetic test" } });
      });
      let page = await context.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${origin}/portal/offline`);
      await page.getByText("Programa original", { exact: true }).waitFor();
      await page.getByText("Sincronizado", { exact: true }).waitFor();
      await context.setOffline(true);
      await page.close(); page = await context.newPage(); page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(`${origin}/portal/login`);
      await page.getByText("Modo sin conexión", { exact: true }).waitFor();
      await page.getByLabel("Reps de la serie 1", { exact: true }).fill("12");
      await page.waitForFunction(() => document.body.textContent.includes("pendiente(s) de sincronización"));
      assert.equal((await readRecords(page))[0].payload.exercises[0].sets[0].repetitions, 12);
      await page.close(); page = await context.newPage();
      await page.goto(`${origin}/portal/rutina`);
      await page.getByLabel("Reps de la serie 1", { exact: true }).waitFor();
      assert.equal(await page.getByLabel("Reps de la serie 1", { exact: true }).inputValue(), "12");
      // A changed trainer program must not replace an in-progress original session.
      snapshot = { ...snapshot, data: { ...snapshot.data, routine: { ...snapshot.data.routine, name: "Programa modificado" } } };
      await context.setOffline(false);
      await page.getByText("Fallo simulado; registros conservados", { exact: true }).waitFor();
      assert.equal((await readRecords(page))[0].pending, true);
      rejectSave = false;
      await page.getByRole("button", { name: "Reintentar sincronización" }).click();
      await page.getByText("Sincronizado", { exact: true }).waitFor();
      assert.equal(persisted.size, 1); assert.equal((await readRecords(page))[0].pending, false);
      await page.getByText("Programa original", { exact: true }).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.screenshot({ path: path.join(process.cwd(), `.offline-${serviceType.toLowerCase()}.png`), fullPage: true });
      await context.setOffline(true);
      await page.getByRole("checkbox").first().check();
      await page.getByRole("button", { name: "Finalizar entrenamiento", exact: true }).click();
      const summary = page.getByRole("dialog", { name: "Finalizar entrenamiento" });
      await summary.getByRole("combobox").selectOption("Buena");
      await summary.getByRole("spinbutton").fill("35");
      await page.getByRole("button", { name: "Confirmar y finalizar", exact: true }).click();
      await page.getByText("Entrenamiento guardado correctamente", { exact: true }).waitFor();
      assert.equal((await readRecords(page))[0].payload.status, "finalizado");
      assert.equal((await readRecords(page))[0].pending, true);
      await context.setOffline(false);
      // Use the offline route directly after the original completion redirect.
      await page.goto(`${origin}/portal/offline`);
      await page.getByText("Sincronizado", { exact: true }).waitFor();
      await page.getByText("Programa modificado", { exact: true }).waitFor();
      assert.equal(persisted.size, 1);
      assert.equal([...persisted.values()][0].status, "finalizado");
      console.log(`${serviceType}: offline completion synced; latest program refreshed afterwards OK`);
      if (serviceType === "MIXED") {
        account = "student-b";
        await page.evaluate(() => window.dispatchEvent(new Event("online")));
        await page.getByText("Todavía no hay una rutina disponible sin conexión en este dispositivo.", { exact: false }).waitFor();
        assert.deepEqual(await readRecords(page), []);
        console.log("Different authenticated student: old snapshot and queue removed");
      } else {
      // Explicit logout removes the snapshot and queue, including when offline.
      await context.setOffline(true); page.once("dialog", (dialog) => dialog.accept());
      await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
      await page.waitForURL("**/portal/login");
      await page.getByText("Todavía no hay una rutina disponible sin conexión en este dispositivo.", { exact: false }).waitFor();
      assert.deepEqual(await readRecords(page), []);
      }
      assert.deepEqual(errors, []);
      console.log(`${serviceType}: reopen offline, edits persisted, retry, no duplicates, pinned program, logout, mobile OK`);
      await context.close();
    }
    const empty = await browser.newContext(); let page = await empty.newPage(); await page.goto(`${origin}/portal/offline`);
    await page.getByText("Todavía no hay una rutina disponible sin conexión en este dispositivo.", { exact: false }).waitFor();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await empty.setOffline(true); await page.close(); page = await empty.newPage(); await page.goto(`${origin}/portal/login`);
    await page.getByText("Todavía no hay una rutina disponible sin conexión en este dispositivo.", { exact: false }).waitFor();
    console.log("No prior routine: clear empty-state OK"); await empty.close();
    // Fully restart the browser process, preserving its actual IndexedDB and service worker.
    const profile = await mkdtemp(path.join(tmpdir(), "bm-offline-smoke-"));
    let persistent;
    try {
      persistent = await chromium.launchPersistentContext(profile, { channel: "msedge", headless: true, viewport: { width: 393, height: 851 } });
      const saved = fixture("PERSONALIZED");
      await persistent.route("**/api/portal/**", (route) => route.fulfill({ json: new URL(route.request().url()).pathname === "/api/portal/offline" ? saved : { offlineIdentity: { studentId: saved.studentId, workspaceId: saved.workspaceId, sessionId: saved.sessionId } } }));
      let coldPage = await persistent.newPage(); await coldPage.goto(`${origin}/portal/offline`);
      await coldPage.getByText("Sincronizado", { exact: true }).waitFor();
      await persistent.setOffline(true); await coldPage.getByLabel("Kg de la serie 1", { exact: true }).fill("27.5");
      await coldPage.waitForFunction(() => document.body.textContent.includes("pendiente(s) de sincronización"));
      await persistent.close();
      persistent = await chromium.launchPersistentContext(profile, { channel: "msedge", headless: true, viewport: { width: 393, height: 851 } });
      await persistent.setOffline(true); coldPage = await persistent.newPage(); await coldPage.goto(`${origin}/portal/login`);
      await coldPage.getByText("Modo sin conexión", { exact: true }).waitFor();
      assert.equal(await coldPage.getByLabel("Kg de la serie 1", { exact: true }).inputValue(), "27.5");
      console.log("Cold browser restart offline: shell, IndexedDB and pending edits recovered OK");
    } finally {
      await persistent?.close();
      assert.ok(path.resolve(profile).startsWith(`${path.resolve(tmpdir())}${path.sep}`) && path.basename(profile).startsWith("bm-offline-smoke-"));
      await rm(profile, { recursive: true, force: true });
    }
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
