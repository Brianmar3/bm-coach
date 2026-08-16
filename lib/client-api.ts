export type ClientApiErrorKind = "session" | "forbidden" | "not-found" | "conflict" | "server" | "network" | "request";

export class ClientApiError extends Error {
  readonly kind: ClientApiErrorKind;
  readonly status: number | null;

  constructor(
    message: string,
    kind: ClientApiErrorKind,
    status: number | null = null,
  ) {
    super(message);
    this.name = "ClientApiError";
    this.kind = kind;
    this.status = status;
  }
}

export function safeInternalPath(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "https://bm-training.local");
    return parsed.origin === "https://bm-training.local" ? `${parsed.pathname}${parsed.search}${parsed.hash}` : fallback;
  } catch {
    return fallback;
  }
}

function kindForStatus(status: number): ClientApiErrorKind {
  if (status === 401) return "session";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 409) return "conflict";
  if (status >= 500) return "server";
  return "request";
}

async function errorMessage(response: Response, fallback: string) {
  try {
    const body = await response.json() as { error?: unknown };
    return typeof body.error === "string" && body.error.trim() ? body.error : fallback;
  } catch {
    return fallback;
  }
}

export function redirectExpiredSession(scope: "admin" | "portal") {
  if (typeof window === "undefined") return;
  const fallback = scope === "portal" ? "/portal" : "/dashboard";
  const current = safeInternalPath(`${window.location.pathname}${window.location.search}${window.location.hash}`, fallback);
  const login = scope === "portal" ? "/portal/login" : "/admin/login";
  window.location.assign(`${login}?next=${encodeURIComponent(current)}`);
}

export async function apiRequest<T>(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  options: { fallback: string; scope: "admin" | "portal" },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ClientApiError("No pudimos conectarnos al servidor. Intentá nuevamente.", "network");
  }
  if (!response.ok) {
    const kind = kindForStatus(response.status);
    const serverMessage = await errorMessage(response, options.fallback);
    if (kind === "session") redirectExpiredSession(options.scope);
    const message = kind === "session"
      ? "Tu sesión venció. Volvé a ingresar para continuar."
      : kind === "forbidden"
        ? "No tenés acceso a esta sección."
        : kind === "server"
          ? "Ocurrió un error al procesar la solicitud. Reintentá."
          : serverMessage;
    throw new ClientApiError(message, kind, response.status);
  }
  try {
    return await response.json() as T;
  } catch {
    throw new ClientApiError(options.fallback, "server", response.status);
  }
}
