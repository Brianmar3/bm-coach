export type PushUiState = "loading" | "unsupported" | "iphone-browser" | "blocked" | "inactive" | "active" | "unconfigured" | "error";

export function resolvePushUiState(input: { supported: boolean; iphoneBrowser: boolean; permission: NotificationPermission; configured: boolean; hasSubscription: boolean; backendActive: boolean }): PushUiState {
  if (!input.supported) return "unsupported";
  if (input.iphoneBrowser) return "iphone-browser";
  if (input.permission === "denied") return "blocked";
  if (!input.configured) return "unconfigured";
  return input.permission === "granted" && input.hasSubscription && input.backendActive ? "active" : "inactive";
}

export function sameApplicationServerKey(subscription: PushSubscription, expected: Uint8Array) {
  const current = subscription.options.applicationServerKey;
  if (!current) return false;
  const bytes = new Uint8Array(current);
  return bytes.length === expected.length && bytes.every((value, index) => value === expected[index]);
}
