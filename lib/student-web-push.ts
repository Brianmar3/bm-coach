import { sameApplicationServerKey } from "./push-notification-state";

export class StudentWebPushError extends Error {
  constructor(public stage: "getSubscription" | "unsubscribe" | "subscribe" | "server", public status?: number, public errorName = "UnknownError") {
    super(stage);
  }
}

export function safePushErrorName(error: unknown) {
  const name = error instanceof Error || error instanceof DOMException ? error.name : "";
  return /^(AbortError|NotAllowedError|InvalidStateError|InvalidAccessError|NotSupportedError|SecurityError|NetworkError|OperationError|ServiceWorkerError|TypeError|Error)$/.test(name) ? name : "UnknownError";
}

export async function activateStudentWebPush(manager: PushManager, key: Uint8Array<ArrayBuffer>, register: (subscription: PushSubscription) => Promise<Response>, reportPrevious?: (state: "ausente" | "vigente" | "vencida" | "clave distinta" | "clave no disponible") => void) {
  let subscription: PushSubscription;
  let stage: "getSubscription" | "unsubscribe" | "subscribe" = "getSubscription";
  try {
    const existing = await manager.getSubscription();
    const expired = existing?.expirationTime != null && existing.expirationTime <= Date.now();
    const compatible = existing && sameApplicationServerKey(existing, key);
    reportPrevious?.(!existing ? "ausente" : expired ? "vencida" : compatible ? "vigente" : existing.options.applicationServerKey ? "clave distinta" : "clave no disponible");
    if (existing && !expired && compatible) {
      subscription = existing;
    } else {
      if (existing) {
        stage = "unsubscribe";
        await existing.unsubscribe();
        if (await manager.getSubscription()) throw new Error("Subscription still present");
      }
      stage = "subscribe";
      subscription = await manager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }
  } catch (error) {
    throw new StudentWebPushError(stage, undefined, safePushErrorName(error));
  }
  let response: Response;
  try { response = await register(subscription); } catch (error) { throw new StudentWebPushError("server", undefined, safePushErrorName(error)); }
  if (!response.ok) throw new StudentWebPushError("server", response.status);
  return response;
}
