self.__BM_TRAINING_SW_VERSION__ = "push-v10-offline-v1";
const OFFLINE_CACHE = "bm-public-offline-v1";
const OFFLINE_SHELL = "/portal/offline";

async function prepareOfflineShell() {
  const cache = await caches.open(OFFLINE_CACHE);
  // This page is public and contains no server-rendered student information.
  const response = await fetch(OFFLINE_SHELL, { cache: "reload", credentials: "omit" });
  if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) throw new Error("Offline shell unavailable");
  const html = await response.clone().text();
  const assets = [...html.matchAll(/(?:src|href)="([^" ]+)"/g)].map((match) => new URL(match[1].replaceAll("&amp;", "&"), self.location.origin)).filter((url) => url.origin === self.location.origin && url.pathname.startsWith("/_next/static/"));
  await Promise.all(assets.map(async (url) => {
    const asset = await fetch(url.href, { cache: "reload", credentials: "omit" });
    if (!asset.ok) throw new Error("Offline asset unavailable");
    await cache.put(url.href, asset);
  }));
  await cache.put(OFFLINE_SHELL, response);
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "BM_PREPARE_OFFLINE") event.waitUntil(prepareOfflineShell().then(() => event.ports[0]?.postMessage({ ready: true })).catch(() => event.ports[0]?.postMessage({ ready: false })));
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(caches.open(OFFLINE_CACHE).then(async (cache) => {
      const stored = await cache.match(request);
      if (stored) return stored;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    }));
  } else if (request.mode === "navigate" && (url.pathname === "/portal" || url.pathname.startsWith("/portal/"))) {
    event.respondWith(fetch(request).catch(async () => {
      const stored = await (await caches.open(OFFLINE_CACHE)).match(OFFLINE_SHELL);
      return stored ?? new Response('<!doctype html><html lang="es"><meta name="viewport" content="width=device-width"><title>BM Training</title><body style="background:#111;color:#fff;font-family:sans-serif;padding:24px"><h1>Sin conexión</h1><p>Todavía no hay una rutina disponible sin conexión en este dispositivo. Abrí la app con internet para guardarla.</p></body></html>', { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }));
  }
});

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

self.addEventListener("install", (event) => {
  event.waitUntil(prepareOfflineShell().catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Nueva notificación",
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
      icon: "/icons/bm-training-pwa-192-v7.png",
      badge: "/icons/bm-training-pwa-192-v7.png",
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
