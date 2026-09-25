import "server-only";

import { prisma } from "@/lib/prisma";
import {
  firebaseMessagingConfigured,
  sendNativePush,
  type NativePushPayload,
} from "@/lib/firebase-admin";

export const NATIVE_PUSH_APP_IDS = [
  "com.bmtraining.app.capacitortest",
  "com.bmtraining.app",
] as const;

export function validNativePushAppId(value: unknown): value is (typeof NATIVE_PUSH_APP_IDS)[number] {
  return typeof value === "string" && NATIVE_PUSH_APP_IDS.includes(value as (typeof NATIVE_PUSH_APP_IDS)[number]);
}

export function validNativePushToken(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_:\-]{32,4096}$/.test(value);
}

export function getNativePushPublicConfiguration() {
  return { configured: firebaseMessagingConfigured() };
}

async function updateStudentResults(
  results: Awaited<ReturnType<typeof sendNativePush>>["results"],
) {
  await Promise.all(results.map((result) =>
    prisma.studentNativePushDevice.update({
      where: { id: result.id },
      data: {
        active: result.invalid ? false : true,
        lastUsedAt: result.delivered ? new Date() : undefined,
        lastError: result.delivered ? null : result.error,
      },
    }),
  ));
}

async function updateTrainerResults(
  results: Awaited<ReturnType<typeof sendNativePush>>["results"],
) {
  await Promise.all(results.map((result) =>
    prisma.trainerNativePushDevice.update({
      where: { id: result.id },
      data: {
        active: result.invalid ? false : true,
        lastUsedAt: result.delivered ? new Date() : undefined,
        lastError: result.delivered ? null : result.error,
      },
    }),
  ));
}

export async function sendStudentNativePush(
  studentId: string,
  payload: NativePushPayload,
) {
  const devices = await prisma.studentNativePushDevice.findMany({
    where: { studentId, active: true, platform: "ANDROID" },
    select: { id: true, token: true },
  });
  const result = await sendNativePush(devices, payload);
  await updateStudentResults(result.results);
  return result;
}

export async function sendTrainerNativePush(
  workspaceId: string,
  payload: NativePushPayload,
) {
  const devices = await prisma.trainerNativePushDevice.findMany({
    where: { workspaceId, active: true, platform: "ANDROID" },
    select: { id: true, token: true },
  });
  const result = await sendNativePush(devices, payload);
  await updateTrainerResults(result.results);
  return result;
}

export async function sendTrainerNativeTestPush(device: { id: string; token: string }) {
  const result = await sendNativePush([device], {
    title: "BM Training",
    body: "Las notificaciones del entrenador están activadas correctamente.",
    url: "/dashboard",
    tag: "trainer-native-push-test",
  });
  await updateTrainerResults(result.results);
  return result;
}
