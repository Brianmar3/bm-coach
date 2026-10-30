import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { runInNewContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
function sourceModule(file) {
  const record = { exports: {} };
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  runInNewContext(source, { exports: record.exports, module: record, require });
  return record.exports;
}
const master = JSON.parse(readFileSync("public/master/manifest.webmanifest", "utf8"));
const trainer = sourceModule("app/manifest.ts").default();
const student = JSON.parse(readFileSync("public/portal/manifest.webmanifest", "utf8"));
const metadata = sourceModule("lib/master-pwa.ts").masterPwaMetadata;

test("Master tiene identidad instalable propia y abre exactamente /master", () => {
  assert.equal(master.name, "BM Training Master");
  assert.equal(master.short_name, "BM Master");
  assert.equal(master.id, "/master"); assert.equal(master.start_url, "/master");
  assert.equal(master.display, "standalone");
  assert.deepEqual(master.display_override, ["standalone"]);
  assert.equal(master.theme_color, "#000000");
  for (const size of ["192x192", "512x512"]) assert.ok(master.icons.some(icon => icon.sizes === size && icon.purpose === "any"));
  assert.ok(master.icons.some(icon => icon.purpose === "maskable" && icon.sizes === "512x512"));
  for (const icon of master.icons) assert.ok(existsSync(`public${icon.src}`));
});

test("Trainer y Alumno conservan sus identidades y destinos; no se migra la app /admin a Master", () => {
  assert.equal(trainer.id, "/admin"); assert.equal(trainer.start_url, "/dashboard"); assert.equal(trainer.scope, "/");
  assert.equal(student.id, "/portal"); assert.equal(student.start_url, "/portal"); assert.equal(student.scope, "/portal/");
  assert.equal(new Set([master.id, trainer.id, student.id]).size, 3);
  assert.equal(new Set([master.start_url, trainer.start_url, student.start_url]).size, 3);
});

test("Master publica su manifest antes y después de autenticar, incluso al instalar desde /platform", () => {
  assert.equal(metadata.manifest, "/master/manifest.webmanifest");
  assert.equal(metadata.applicationName, master.name); assert.equal(metadata.appleWebApp.title, master.name);
  for (const file of ["app/master/layout.tsx", "app/platform/layout.tsx"]) {
    const source = readFileSync(file, "utf8");
    assert.match(source, /import \{ masterPwaMetadata \} from "@\/lib\/master-pwa"/);
    assert.match(source, /export const metadata = masterPwaMetadata/);
  }
  assert.match(readFileSync("app/layout.tsx", "utf8"), /manifest: "\/manifest.webmanifest"/);
  assert.match(readFileSync("app/portal/layout.tsx", "utf8"), /manifest: "\/portal\/manifest.webmanifest"/);
});

test("el scope Master cubre login y plataforma sin convertirse en un permiso de acceso", () => {
  const scope = new URL(master.scope, "https://bm.test");
  for (const route of [master.start_url, "/platform", "/platform/trainers", "/platform/settings"]) assert.ok(new URL(route, scope).pathname.startsWith(scope.pathname));
  assert.match(readFileSync("app/platform/layout.tsx", "utf8"), /await requirePlatformOwnerPage\(\)/);
  const access = readFileSync("lib/platform-session-access.ts", "utf8");
  assert.match(access, /verifyPlatformSessionValue/); assert.match(access, /platformRole === "PLATFORM_OWNER"/);
});

test("el worker compartido no sustituye navegaciones Master ni cachea su manifest", () => {
  const listeners = new Map();
  const self = { addEventListener: (name, listener) => listeners.set(name, listener) };
  runInNewContext(readFileSync("public/sw.js", "utf8"), { self, URL });
  // The worker reads its own origin when a fetch arrives.
  self.location = { origin: "https://bm.test" };
  for (const route of ["/master", "/platform/trainers", "/platform/settings", "/master/manifest.webmanifest", "/manifest.webmanifest", "/portal/manifest.webmanifest"]) {
    let intercepted = false;
    listeners.get("fetch")({ request: { method: "GET", mode: route.endsWith(".webmanifest") ? "cors" : "navigate", url: `https://bm.test${route}` }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false, route);
  }
});
