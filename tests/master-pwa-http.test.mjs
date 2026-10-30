import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { existsSync } from "node:fs";
import path from "node:path";
import { once } from "node:events";

// Explicit integration suite: actual Next production output, cookies and redirects, no real database.
let server;
let base;
let ownerCookie;
let trainerCookie;
const android = "Mozilla/5.0 (Linux; Android 14; Test Device) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Mobile Safari/537.36";
const manifestLinks = html => [...html.matchAll(/<link\b[^>]*rel="manifest"[^>]*>/g)].map(match => /href="([^"]+)"/.exec(match[0])?.[1]);
const cookieHeader = response => response.headers.getSetCookie().map(value => value.split(";", 1)[0]).join("; ");
const request = (route, cookie = "", options = {}) => fetch(`${base}${route}`, { redirect: "manual", ...options, headers: { "user-agent": android, ...(cookie ? { cookie } : {}), ...options.headers } });

before(async () => {
  assert.ok(existsSync(".next/BUILD_ID"), "Run next build before this production HTTP suite.");
  const reservation = createServer(); reservation.listen(0, "127.0.0.1"); await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["--require", path.resolve("tests/fixtures/master-browser-store.cjs"), path.resolve("node_modules/next/dist/bin/next"), "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: process.cwd(), stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, NODE_ENV: "production", DATABASE_URL: "postgresql://local_only:local_only@127.0.0.1:1/bm_master_browser", BM_COACH_ADMIN_TOKEN: "master-pwa-local-fixture-secret-1234567890", BM_MASTER_BROWSER_FIXTURE: "1", MASTER_EMAIL_ENABLED: "false", NEXT_TELEMETRY_DISABLED: "1" },
  });
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Local production server did not become ready.")), 30000);
    const finish = error => { clearTimeout(timer); if (error) reject(error); else resolve(); };
    server.stdout.on("data", data => { if (data.toString().includes("Ready")) finish(); });
    server.once("error", finish); server.once("exit", code => finish(new Error(`Local server exited: ${code}`)));
  });
  for (const [endpoint, type] of [["/api/admin/auth/login", "trainer"], ["/api/platform/auth/login", "owner"]]) {
    const response = await request(endpoint, "", { method: "POST", headers: { origin: base, "content-type": "application/json" }, body: JSON.stringify({ email: "master-fixture@bm.test", password: "MasterFixture123!" }) });
    assert.equal(response.status, 200);
    if (type === "trainer") trainerCookie = cookieHeader(response); else ownerCookie = cookieHeader(response);
  }
});
after(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit"); server.kill(); await exited;
  }
});

test("HTTP producción: manifest Master público, JSON válido e identidad distinta", async () => {
  const response = await request("/master/manifest.webmanifest");
  assert.equal(response.status, 200); assert.match(response.headers.get("content-type"), /application\/(?:manifest\+)?json/);
  const master = await response.json();
  assert.equal(master.name, "BM Training Master"); assert.equal(master.id, "/master"); assert.equal(master.start_url, "/master");
  const trainer = await (await request("/manifest.webmanifest")).json();
  const student = await (await request("/portal/manifest.webmanifest")).json();
  assert.equal(trainer.id, "/admin"); assert.equal(trainer.start_url, "/dashboard");
  assert.equal(student.id, "/portal"); assert.equal(student.start_url, "/portal");
  assert.equal(new Set([master.id, trainer.id, student.id]).size, 3);
});

test("HTML Android /master tiene un único manifest Master incluso con Trainer autenticado", async () => {
  for (const cookie of ["", trainerCookie]) {
    const response = await request("/master", cookie); assert.equal(response.status, 200);
    const html = await response.text(); assert.deepEqual(manifestLinks(html), ["/master/manifest.webmanifest"]);
    assert.match(html, /<title>BM Training Master<\/title>/);
    assert.match(html, /name="application-name" content="BM Training Master"/);
  }
});

test("start_url Master: propietario, ambas sesiones y recarga permanecen en plataforma", async () => {
  for (const cookie of [ownerCookie, `${ownerCookie}; ${trainerCookie}`]) {
    const launch = await request("/master", cookie);
    assert.equal(launch.status, 307); assert.equal(new URL(launch.headers.get("location"), base).pathname, "/platform/trainers");
    for (let reload = 0; reload < 2; reload++) {
      const response = await request("/platform/trainers", cookie); assert.equal(response.status, 200);
      assert.deepEqual(manifestLinks(await response.text()), ["/master/manifest.webmanifest"]);
    }
    const settings = await request("/platform/settings", cookie); assert.equal(settings.status, 200);
    assert.deepEqual(manifestLinks(await settings.text()), ["/master/manifest.webmanifest"]);
  }
});

test("start_url Trainer sigue abriendo Dashboard y su HTML mantiene manifest general", async () => {
  for (const cookie of [trainerCookie, `${ownerCookie}; ${trainerCookie}`]) {
    const response = await request("/dashboard", cookie); assert.equal(response.status, 200);
    assert.deepEqual(manifestLinks(await response.text()), ["/manifest.webmanifest"]);
  }
  const response = await request("/dashboard");
  assert.equal(new URL(response.headers.get("location"), base).pathname, "/admin/login");
});

test("Alumno mantiene su manifest y Master sigue protegido sin sesiones", async () => {
  const response = await request("/portal/login"); assert.equal(response.status, 200);
  assert.deepEqual(manifestLinks(await response.text()), ["/portal/manifest.webmanifest"]);
  const platform = await request("/platform/settings"); assert.equal(platform.status, 307);
  assert.equal(new URL(platform.headers.get("location"), base).pathname, "/master");
  assert.equal((await request("/api/platform/trainers")).status, 401);
});
