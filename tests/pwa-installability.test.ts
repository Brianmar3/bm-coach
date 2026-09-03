import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const manifest = JSON.parse(readFileSync("public/portal/manifest.webmanifest", "utf8"));
const registration = readFileSync("componentes/pwa-service-worker-registration.tsx", "utf8");
const layout = readFileSync("app/layout.tsx", "utf8");

test("el manifest del portal abre dentro de scope en modo standalone", () => {
  assert.equal(manifest.id, "/portal");
  assert.equal(manifest.start_url, "/portal");
  assert.equal(manifest.scope, "/portal/");
  assert.equal(manifest.display, "standalone");
  assert.deepEqual(manifest.display_override, ["standalone"]);
  assert.equal(manifest.icons.some((icon: { sizes?: string }) => icon.sizes === "192x192"), true);
  assert.equal(manifest.icons.some((icon: { sizes?: string }) => icon.sizes === "512x512"), true);
});

test("el service worker se registra al cargar y no depende de activar push", () => {
  assert.match(registration, /navigator\.serviceWorker\.register\("\/sw\.js"/);
  assert.match(registration, /scope: "\/"/);
  assert.match(layout, /<PwaServiceWorkerRegistration \/>/);
});
