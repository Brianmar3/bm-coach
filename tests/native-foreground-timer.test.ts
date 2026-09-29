import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync(new URL("../bm-training-capacitor/android/app/src/main/java/com/bmtraining/app/BmTimerForegroundService.java", import.meta.url), "utf8");
const plugin = readFileSync(new URL("../bm-training-capacitor/android/app/src/main/java/com/bmtraining/app/BmTimerPlugin.java", import.meta.url), "utf8");
const activity = readFileSync(new URL("../bm-training-capacitor/android/app/src/main/java/com/bmtraining/app/MainActivity.java", import.meta.url), "utf8");
const manifest = readFileSync(new URL("../bm-training-capacitor/android/app/src/main/AndroidManifest.xml", import.meta.url), "utf8");
const bridge = readFileSync(new URL("../lib/native-timer-notifications.ts", import.meta.url), "utf8");
const rest = readFileSync(new URL("../componentes/rest-timer-provider.tsx", import.meta.url), "utf8");
const block = readFileSync(new URL("../componentes/workout-block-timer.tsx", import.meta.url), "utf8");

test("el servicio usa una sola notificación y el cronómetro regresivo nativo", () => {
  assert.match(service, /NOTIFICATION_ID = 78101/);
  assert.match(service, /\.setWhen\(timer\.endAt\)/);
  assert.match(service, /\.setUsesChronometer\(true\)/);
  assert.match(service, /\.setChronometerCountDown\(true\)/);
  assert.match(service, /\.setOngoing\(true\)/);
  assert.doesNotMatch(service, /postDelayed\([^,]+,\s*1000/);
});

test("Android declara specialUse mínimo y nunca USE_EXACT_ALARM", () => {
  assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE/);
  assert.match(manifest, /android\.permission\.FOREGROUND_SERVICE_SPECIAL_USE/);
  assert.match(manifest, /android:foregroundServiceType="specialUse"/);
  assert.match(manifest, /android\.permission\.SCHEDULE_EXACT_ALARM/);
  assert.doesNotMatch(manifest, /android\.permission\.USE_EXACT_ALARM/);
});

test("alarma exacta degrada a inexacta sin depender del permiso", () => {
  assert.match(service, /alarmManager\.canScheduleExactAlarms\(\)/);
  assert.match(service, /setExactAndAllowWhileIdle/);
  assert.match(service, /setAndAllowWhileIdle/);
  assert.match(service, /catch \(SecurityException denied\)/);
});

test("el bridge pequeño expone inicio actualización detención y consulta", () => {
  for (const method of ["startTimer", "updateTimer", "stopTimer", "getActiveTimer"]) assert.match(plugin, new RegExp(`void ${method}|void startTimer|void updateTimer|void stopTimer|void getActiveTimer`));
  assert.match(activity, /registerPlugin\(BmTimerPlugin\.class\)/);
  assert.match(bridge, /registerPlugin<BmTimerPlugin>\("BmTimer"\)/);
});

test("descansos y bloques envían el mismo endAt absoluto al servicio", () => {
  assert.match(rest, /startNativeNotification\(\{ key: `rest:/);
  assert.match(rest, /endAt: next\.endTimestamp/);
  assert.match(block, /startNativeNotification\(\{ key: `block:/);
  assert.match(block, /const endAt = next\.status === "running"/);
  assert.match(block, /cancelNativeNotification\(\)/);
});

test("finalizar limpia estado persistido y detiene el foreground service", () => {
  assert.match(service, /clearActiveTimer\(this\)/);
  assert.match(service, /STOP_FOREGROUND_REMOVE/);
  assert.match(service, /completedNotification\(active\)/);
  assert.match(service, /stopSelf\(\)/);
});
