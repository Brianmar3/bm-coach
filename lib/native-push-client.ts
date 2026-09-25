"use client";

import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import {
  PushNotifications,
  type PermissionStatus,
  type Token,
} from "@capacitor/push-notifications";

export const NATIVE_PUSH_CHANNEL_ID = "bm_training_updates";
const SUPPORTED_APP_IDS = new Set([
  "com.bmtraining.app.capacitortest",
  "com.bmtraining.app",
]);

export type NativePushEnvironment = {
  appId: string;
  appName: string;
  platform: "ANDROID";
};

export async function getNativePushEnvironment(): Promise<NativePushEnvironment | null> {
  if (
    !Capacitor.isNativePlatform() ||
    Capacitor.getPlatform() !== "android" ||
    !Capacitor.isPluginAvailable("PushNotifications") ||
    !Capacitor.isPluginAvailable("App")
  ) {
    return null;
  }

  const info = await App.getInfo();
  if (!SUPPORTED_APP_IDS.has(info.id)) return null;
  return { appId: info.id, appName: info.name, platform: "ANDROID" };
}

export function checkNativePushPermissions() {
  return PushNotifications.checkPermissions();
}

export function requestNativePushPermissions() {
  return PushNotifications.requestPermissions();
}

export function permissionIsBlocked(permission: PermissionStatus) {
  return permission.receive === "denied";
}

export async function registerNativePushToken(timeoutMs = 15000) {
  let timeout = 0;
  let resolveToken!: (token: Token) => void;
  let rejectToken!: (error: Error) => void;
  const tokenPromise = new Promise<Token>((resolve, reject) => {
    resolveToken = resolve;
    rejectToken = reject;
  });
  const registration = await PushNotifications.addListener("registration", resolveToken);
  const registrationError = await PushNotifications.addListener(
    "registrationError",
    (error) => rejectToken(new Error(error.error || "FCM_REGISTRATION_FAILED")),
  );

  try {
    timeout = window.setTimeout(
      () => rejectToken(new Error("FCM_REGISTRATION_TIMEOUT")),
      timeoutMs,
    );
    await PushNotifications.register();
    const token = await tokenPromise;
    if (!token.value.trim()) throw new Error("FCM_TOKEN_EMPTY");
    return token.value.trim();
  } finally {
    window.clearTimeout(timeout);
    await registration.remove().catch(() => undefined);
    await registrationError.remove().catch(() => undefined);
  }
}

export async function createNativePushChannel() {
  await PushNotifications.createChannel({
    id: NATIVE_PUSH_CHANNEL_ID,
    name: "Avisos de BM Training",
    description: "Asistencia, pagos, logros y novedades de entrenamiento.",
    importance: 4,
    visibility: 1,
    vibration: true,
  });
}

export async function unregisterNativePush() {
  await PushNotifications.unregister();
}

function safeNotificationPath(value: unknown) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return null;
  }
  try {
    const parsed = new URL(value, window.location.origin);
    return parsed.origin === window.location.origin
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : null;
  } catch {
    return null;
  }
}

export async function listenForNativePushActions() {
  return PushNotifications.addListener(
    "pushNotificationActionPerformed",
    ({ notification }) => {
      const target = safeNotificationPath(notification.data?.url);
      if (target) window.location.assign(target);
    },
  );
}
