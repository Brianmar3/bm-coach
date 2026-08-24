import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const view = readFileSync("componentes/student-profile-view.tsx", "utf8");
const route = readFileSync("app/api/portal/profile/route.ts", "utf8");
const push = readFileSync("componentes/push-notifications-card.tsx", "utf8");

test("profile keeps real avatar route and exposes anchored settings", () => {
  assert.match(view, /\/portal\/perfil\/avatar/);
  assert.match(view, /aria-label="Abrir ajustes"/);
  assert.match(view, /role="dialog"/);
  assert.match(view, /Escape/);
});

test("student profile update is self-scoped and allowlisted", () => {
  assert.match(route, /getPortalSession/);
  assert.match(route, /session\.studentId/);
  assert.match(route, /new Set\(\["phone", "email", "birthDate", "goal"\]\)/);
  assert.doesNotMatch(route, /serviceType.*value|status.*value|plan.*value/);
});

test("settings reuses the real push subscription flow", () => {
  assert.match(view, /PushNotificationsCard compact/);
  assert.match(push, /role="switch"/);
  assert.match(push, /state === "active" \? deactivate : activate/);
});
