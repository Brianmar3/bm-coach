"use client";

import { Capacitor, registerPlugin, type Plugin } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";

const TIMER_CHANNEL_ID = "bm_training_timers";
let permissionPreparation: Promise<boolean> | null = null;
let fallbackNotificationId: number | null = null;

export type NativeTimerNotification = {
  key: string;
  title: string;
  body: string;
  endAt: number;
  type: string;
  completionTitle: string;
  completionBody: string;
};

export type NativeActiveTimer = {
  active: boolean;
  timerId?: string;
  endAt?: number;
  type?: string;
  title?: string;
  context?: string;
  status?: "running" | "finished";
};

type BmTimerPlugin = Plugin & {
  startTimer(options: { timerId: string; endAt: number; type: string; title: string; context: string; completionTitle: string; completionBody: string }): Promise<void>;
  updateTimer(options: { timerId: string; endAt: number; type: string; title: string; context: string; completionTitle: string; completionBody: string }): Promise<void>;
  stopTimer(options: { timerId?: string }): Promise<void>;
  getActiveTimer(): Promise<NativeActiveTimer>;
};

const BmTimer = registerPlugin<BmTimerPlugin>("BmTimer");

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
    await LocalNotifications.createChannel({ id: TIMER_CHANNEL_ID, name: "Temporizadores de entrenamiento", description: "Avisos al terminar un descanso o bloque de entrenamiento.", importance: 4, visibility: 1, vibration: true, lights: true, lightColor: "#FACC15" });
  }
  return true;
}

export function requestNativeTimerNotificationPermission() {
  permissionPreparation ??= prepareNativeTimerNotifications().catch(() => false);
  return permissionPreparation;
}

async function scheduleCompletionFallback(notification: NativeTimerNotification) {
  if (notification.endAt <= Date.now() || !(await requestNativeTimerNotificationPermission())) return null;
  const id = nativeTimerNotificationId(notification.key, notification.endAt);
  let exactAlarm = true;
  if (Capacitor.getPlatform() === "android") exactAlarm = await LocalNotifications.checkExactNotificationSetting().then((status) => status.exact_alarm === "granted").catch(() => false);
  if (fallbackNotificationId !== null) await LocalNotifications.cancel({ notifications: [{ id: fallbackNotificationId }] });
  await LocalNotifications.schedule({ notifications: [{ id, title: notification.completionTitle, body: notification.completionBody, channelId: TIMER_CHANNEL_ID, schedule: { at: new Date(notification.endAt), allowWhileIdle: true }, isExactNotification: exactAlarm, isExactMandatory: false, autoCancel: true, foreground: false, extra: { kind: "workout-timer", timerId: notification.key, endAt: notification.endAt } }] });
  fallbackNotificationId = id;
  return id;
}

export async function startNativeTimer(notification: NativeTimerNotification) {
  if (!nativeTimerNotificationsAvailable() || notification.endAt <= Date.now()) return false;
  void requestNativeTimerNotificationPermission();
  try {
    await BmTimer.startTimer({ timerId: notification.key, endAt: notification.endAt, type: notification.type, title: notification.title, context: notification.body, completionTitle: notification.completionTitle, completionBody: notification.completionBody });
    if (fallbackNotificationId !== null) {
      await LocalNotifications.cancel({ notifications: [{ id: fallbackNotificationId }] }).catch(() => undefined);
      fallbackNotificationId = null;
    }
    return true;
  } catch {
    await scheduleCompletionFallback(notification).catch(() => null);
    return false;
  }
}

export async function stopNativeTimer(timerId?: string) {
  if (!nativeTimerNotificationsAvailable()) return;
  await BmTimer.stopTimer({ timerId }).catch(() => undefined);
  if (fallbackNotificationId !== null) {
    await LocalNotifications.cancel({ notifications: [{ id: fallbackNotificationId }] }).catch(() => undefined);
    fallbackNotificationId = null;
  }
}

export async function getActiveNativeTimer(): Promise<NativeActiveTimer | null> {
  if (!nativeTimerNotificationsAvailable()) return null;
  return BmTimer.getActiveTimer().catch(() => null);
}
