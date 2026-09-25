import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging, type MulticastMessage } from "firebase-admin/messaging";

export type NativePushPayload = {
  title: string;
  body: string;
  url?: string;
  tag: string;
};

type NativePushTarget = {
  id: string;
  token: string;
};

export type NativePushResult = {
  configured: boolean;
  delivered: boolean;
  results: Array<{
    id: string;
    delivered: boolean;
    invalid: boolean;
    error: string | null;
  }>;
};

function firebaseCredentials() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ?.replace(/\\n/g, "\n")
    .trim();

  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

export function firebaseMessagingConfigured() {
  return Boolean(firebaseCredentials());
}

function messaging() {
  const credentials = firebaseCredentials();
  if (!credentials) return null;
  const app =
    getApps()[0] ??
    initializeApp({
      credential: cert(credentials),
      projectId: credentials.projectId,
    });
  return getMessaging(app);
}

const invalidTokenCodes = new Set([
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
]);

export async function sendNativePush(
  targets: NativePushTarget[],
  payload: NativePushPayload,
): Promise<NativePushResult> {
  const client = messaging();
  if (!client) return { configured: false, delivered: false, results: [] };
  if (!targets.length) return { configured: true, delivered: false, results: [] };

  const message: MulticastMessage = {
    tokens: targets.map((target) => target.token),
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: {
      url: payload.url ?? "/",
      tag: payload.tag,
    },
    android: {
      priority: "high",
      notification: {
        channelId: "bm_training_updates",
        icon: "ic_stat_bm_notification",
        tag: payload.tag,
        color: "#D4AF37",
      },
    },
  };

  try {
    const response = await client.sendEachForMulticast(message);
    const results = response.responses.map((item, index) => {
      const error = item.error?.code ?? item.error?.message ?? null;
      return {
        id: targets[index].id,
        delivered: item.success,
        invalid: item.error ? invalidTokenCodes.has(item.error.code) : false,
        error: error?.slice(0, 500) ?? null,
      };
    });
    return {
      configured: true,
      delivered: results.some((item) => item.delivered),
      results,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error FCM";
    return {
      configured: true,
      delivered: false,
      results: targets.map((target) => ({
        id: target.id,
        delivered: false,
        invalid: false,
        error: message.slice(0, 500),
      })),
    };
  }
}
