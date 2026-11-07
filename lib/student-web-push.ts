import { sameApplicationServerKey } from "./push-notification-state";

export class StudentWebPushError extends Error {
  constructor(public stage: "browser" | "server", public status?: number) {
    super(stage);
  }
}

export async function activateStudentWebPush(manager: PushManager, key: Uint8Array<ArrayBuffer>, register: (subscription: PushSubscription) => Promise<Response>) {
  let subscription: PushSubscription;
  try {
    const existing = await manager.getSubscription();
    const expired = existing?.expirationTime != null && existing.expirationTime <= Date.now();
    if (existing && !expired && sameApplicationServerKey(existing, key)) {
      subscription = existing;
    } else {
      if (existing) {
        await existing.unsubscribe();
        if (await manager.getSubscription()) throw new Error("Subscription still present");
      }
      subscription = await manager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }
  } catch {
    throw new StudentWebPushError("browser");
  }
  let response: Response;
  try { response = await register(subscription); } catch { throw new StudentWebPushError("server"); }
  if (!response.ok) throw new StudentWebPushError("server", response.status);
  return response;
}
