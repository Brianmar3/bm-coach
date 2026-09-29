"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const TIMER_CHANNEL_ID = "bm_training_timers";
let permissionPreparation: Promise<boolean> | null = null;

export type NativeTimerNotification = {
  key: string;
  title: string;
  body: string;
  endAt: number;
};

export function nativeTimerNotificationsAvailable() {
  return Capacitor.isNativePlatform();
}

export function nativeTimerNotificationId(key: string, endAt: number) {
  const source = `${key}:${Math.trunc(endAt)}`;
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) & 0x7fffffff;
}

async function prepareNativeTimerNotifications() {
  if (!nativeTimerNotificationsAvailable()) return false;
  const current = await LocalNotifications.checkPermissions();
  const permission = current.display === "prompt" || current.display === "prompt-with-rationale"
    ? await LocalNotifications.requestPermissions()
    : current;
  if (permission.display !== "granted") return false;
  if (Capacitor.getPlatform() === "android") {
    await LocalNotifications.createChannel({
      id: TIMER_CHANNEL_ID,
      name: "Temporizadores de entrenamiento",
      description: "Avisos al terminar un descanso o bloque de entrenamiento.",
      importance: 4,
      visibility: 1,
      vibration: true,
      lights: true,
      lightColor: "#FACC15",
    });
  }
  return true;
}

export function requestNativeTimerNotificationPermission() {
  permissionPreparation ??= prepareNativeTimerNotifications().catch(() => false);
  return permissionPreparation;
}

export async function scheduleNativeTimerNotification(notification: NativeTimerNotification) {
  if (notification.endAt <= Date.now() || !(await requestNativeTimerNotificationPermission())) return null;
  const id = nativeTimerNotificationId(notification.key, notification.endAt);
  let exactAlarm = true;
  if (Capacitor.getPlatform() === "android") {
    exactAlarm = await LocalNotifications.checkExactNotificationSetting()
      .then((status) => status.exact_alarm === "granted")
      .catch(() => false);
  }
  await LocalNotifications.cancel({ notifications: [{ id }] });
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title: notification.title,
      body: notification.body,
      channelId: TIMER_CHANNEL_ID,
      schedule: { at: new Date(notification.endAt), allowWhileIdle: true },
      isExactNotification: exactAlarm,
      isExactMandatory: false,
      autoCancel: true,
      foreground: false,
      extra: { kind: "workout-timer", endAt: notification.endAt },
    }],
  });
  return id;
}

export async function cancelNativeTimerNotification(id: number | null) {
  if (id === null || !nativeTimerNotificationsAvailable()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] }).catch(() => undefined);
}
