self.__BM_TRAINING_SW_VERSION__ = "push-v8-live-home";

const BM_PORTAL_FALLBACK = "/portal";
const BM_ALLOWED_NOTIFICATION_PATHS = [
  "/portal/pagos",
  "/portal/puntos",
  "/portal/ranking",
  "/portal/clases",
  "/portal/rutina",
  "/portal/entrenamiento",
  "/portal/evaluaciones",
  "/portal/registro",
  "/portal/nutricion",
  "/portal/progreso",
  "/portal",
];

function safeNotificationTarget(value) {
  try {
    if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return BM_PORTAL_FALLBACK;
    const parsed = new URL(value, self.location.origin);
    const allowed = parsed.origin === self.location.origin && BM_ALLOWED_NOTIFICATION_PATHS.some((root) =>
      root === BM_PORTAL_FALLBACK
        ? parsed.pathname === root
        : parsed.pathname === root || parsed.pathname.startsWith(`${root}/`),
    );
    return allowed ? `${parsed.pathname}${parsed.search}${parsed.hash}` : BM_PORTAL_FALLBACK;
  } catch {
    return BM_PORTAL_FALLBACK;
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Nuevo logro en BM Training",
    body: "Entrá a la app para ver tu progreso.",
    url: BM_PORTAL_FALLBACK,
    tag: "bm-training-achievements",
  };
  try {
    data = { ...data, ...event.data.json() };
  } catch {}
  event.waitUntil(Promise.all([
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/bm-training-pwa-192-v4.png",
      badge: "/icons/bm-training-pwa-192-v4.png",
      tag: data.tag,
      vibrate: [120, 60, 120],
      data: { url: data.url },
    }),
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      windows.forEach((client) => {
        client.postMessage({ type: "BM_PORTAL_DATA_CHANGED", event: data.event ?? null });
        if (data.event === "achievement") client.postMessage({ type: "BM_ACHIEVEMENT_AVAILABLE" });
      });
    }),
  ]));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    safeNotificationTarget(event.notification.data?.url),
    self.location.origin,
  ).href;
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const existing = windows.find(
          (client) => new URL(client.url).origin === self.location.origin,
        );
        if (existing) {
          return existing.navigate(target).then(() => existing.focus());
        }
        return clients.openWindow(target);
      }),
  );
});
