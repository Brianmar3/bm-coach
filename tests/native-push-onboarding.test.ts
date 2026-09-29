import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) { return readFileSync(new URL(`../${path}`, import.meta.url), "utf8"); }

test("onboarding vive en shells posteriores al login de alumno y entrenador", () => {
  assert.match(source("componentes/portal-shell.tsx"), /NativePushOnboarding audience="student"/);
  assert.match(source("componentes/app-frame.tsx"), /NativePushOnboarding audience="trainer"/);
});

test("permiso concedido oculta onboarding y registra dispositivo", () => {
  const value = source("componentes/native-push-onboarding.tsx");
  assert.match(value, /state === "granted"[\s\S]*setMode\("hidden"\)[\s\S]*registerNativePushDevice\(audience, detected\)/);
});

test("no solicitado muestra onboarding y aceptar pide permiso", () => {
  const value = source("componentes/native-push-onboarding.tsx");
  assert.match(value, /state === "blocked" \? "blocked" : "prompt"/);
  assert.match(value, /requestNativePushPermissions\(\)/);
});

test("rechazo tiene cooldown y no entra en loop", () => {
  const value = source("componentes/native-push-onboarding.tsx");
  assert.match(value, /REMIND_AFTER_MS = 30 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(value, /recentDecision\(key\)/);
  assert.match(value, /saveDecision/);
});

test("cambio manual se reconcilia al volver a foreground", () => {
  const value = source("componentes/native-push-onboarding.tsx");
  assert.match(value, /window\.addEventListener\("focus", run\)/);
  assert.match(value, /visibilitychange/);
  assert.match(value, /openNativeNotificationSettings/);
});

test("endpoints separan entrenador y alumno", () => {
  const value = source("lib/native-push-client.ts");
  assert.match(value, /audience === "trainer"/);
  assert.match(value, /\/api\/admin\/native-push/);
  assert.match(value, /\/api\/portal\/native-push/);
});

test("Configuración conserva activación manual y acceso a ajustes", () => {
  const value = source("componentes/push-notifications-card.tsx");
  assert.match(value, /Activar desde configuración/);
  assert.match(value, /openNativeNotificationSettings/);
});

test("Firebase sigue registrando y timer no solicita permiso en paralelo", () => {
  const client = source("lib/native-push-client.ts");
  const timer = source("lib/native-timer-notifications.ts");
  assert.match(client, /PushNotifications\.requestPermissions\(\)/);
  assert.match(client, /PushNotifications\.register\(\)/);
  assert.match(timer, /LocalNotifications\.checkPermissions\(\)/);
  assert.doesNotMatch(timer, /LocalNotifications\.requestPermissions\(\)/);
  assert.match(timer, /BmTimer\.startTimer/);
});
