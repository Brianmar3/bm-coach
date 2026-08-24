import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { resolvePushUiState } from "../lib/push-notification-state.ts";

const view = readFileSync(new URL("../componentes/student-profile-view.tsx", import.meta.url), "utf8");
const push = readFileSync(new URL("../componentes/push-notifications-card.tsx", import.meta.url), "utf8");
const settings = readFileSync(new URL("../componentes/student-profile-settings-page.tsx", import.meta.url), "utf8");

test("push distingue default, granted, denied, unsupported y backend real", () => {
  const base = { supported: true, iphoneBrowser: false, configured: true, hasSubscription: false, backendActive: false };
  assert.equal(resolvePushUiState({ ...base, permission: "default" }), "inactive");
  assert.equal(resolvePushUiState({ ...base, permission: "denied" }), "blocked");
  assert.equal(resolvePushUiState({ ...base, supported: false, permission: "default" }), "unsupported");
  assert.equal(resolvePushUiState({ ...base, permission: "granted", hasSubscription: true, backendActive: true }), "active");
  assert.equal(resolvePushUiState({ ...base, permission: "granted", hasSubscription: true, backendActive: false }), "inactive");
});

test("fallos técnicos dejan el switch apagado en estado temporal", () => {
  assert.match(push, /setState\(Notification\.permission === "denied" \? "blocked" : "error"\)/);
  assert.match(push, /error: "Error temporal"/);
  assert.match(push, /sameApplicationServerKey/);
});

test("cada opción de ajustes usa su ruta propia", () => {
  for (const route of ["seguridad", "privacidad", "preferencias", "ayuda"]) {
    assert.match(view, new RegExp(`/portal/perfil/${route}`));
    assert.ok(existsSync(new URL(`../app/portal/(student)/perfil/${route}/page.tsx`, import.meta.url)));
  }
  assert.doesNotMatch(view, /\/portal\/configuracion#/);
});

test("seguridad reutiliza el formulario real y las páginas son vistas normales", () => {
  assert.match(settings, /<ChangePasswordCard \/>/);
  assert.match(settings, /href="\/portal\/perfil"/);
  assert.match(settings, /prefers-reduced-motion: reduce/);
  assert.doesNotMatch(settings, /fixed inset|role="dialog"|bottom.sheet/i);
});
