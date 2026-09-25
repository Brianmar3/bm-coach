import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string) {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

test("Capacitor usa FCM nativo antes de evaluar compatibilidad Web Push", () => {
  const card = source("componentes/push-notifications-card.tsx");
  assert.ok(
    card.indexOf("getNativePushEnvironment()") <
      card.indexOf('"serviceWorker" in navigator'),
  );
  assert.match(card, /requestNativePushPermissions\(\)/);
  assert.match(card, /registerNativePushToken\(\)/);
  assert.match(card, /Firebase todavía no está configurado para esta APK/);
});

test("Web Push continúa separado de los tokens FCM", () => {
  const schema = source("prisma/schema.prisma");
  const migration = source(
    "prisma/migrations/20260925160000_native_push_devices/migration.sql",
  );
  assert.match(schema, /model StudentNativePushDevice/);
  assert.match(schema, /model TrainerNativePushDevice/);
  assert.match(migration, /student_native_push_devices/);
  assert.match(migration, /trainer_native_push_devices/);
  assert.match(migration, /REFERENCES "students"\("id"\)/);
  assert.match(migration, /REFERENCES "workspaces"\("id"\)/);
});

test("las APIs resuelven cuenta y workspace desde sesiones del servidor", () => {
  const student = source("app/api/portal/native-push/route.ts");
  const trainer = source("app/api/admin/native-push/route.ts");
  assert.match(student, /getPortalSession\(\)/);
  assert.match(student, /studentId: session\.studentId/);
  assert.match(trainer, /requireTrainerWorkspace\(\)/);
  assert.match(trainer, /where: \{ workspaceId, appId/);
  assert.match(student, /trainerNativePushDevice\.updateMany/);
  assert.match(trainer, /studentNativePushDevice\.updateMany/);
});

test("confirmar o rechazar asistencia reutiliza el envío nativo del workspace", () => {
  const trainer = source("lib/trainer-notifications.ts");
  const attendance = source("app/api/portal/clases/route.ts");
  assert.match(trainer, /sendTrainerNativePush\(workspaceId, payload\)/);
  assert.match(attendance, /createAttendanceTrainerNotification/);
  assert.match(attendance, /dispatchTrainerPush/);
  assert.match(trainer, /ClassResponseStatus\.GOING/);
});

test("Android declara permiso, plugin, canal e ícono monocromático", () => {
  const manifest = source(
    "bm-training-capacitor/android/app/src/main/AndroidManifest.xml",
  );
  const settings = source(
    "bm-training-capacitor/android/capacitor.settings.gradle",
  );
  const icon = source(
    "bm-training-capacitor/android/app/src/main/res/drawable/ic_stat_bm_notification.xml",
  );
  assert.match(manifest, /android\.permission\.POST_NOTIFICATIONS/);
  assert.match(manifest, /ic_stat_bm_notification/);
  assert.match(manifest, /bm_training_updates/);
  assert.match(settings, /capacitor-push-notifications/);
  assert.match(icon, /#FFFFFFFF/);
  assert.doesNotMatch(icon, />BM</);
});
