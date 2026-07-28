self.addEventListener("push", (event) => {
  let data = { title: "Nuevo logro en BM Training", body: "Entrá a la app para ver tu progreso.", url: "/portal#logros", tag: "bm-training-achievements" };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: "/icons/bm-training-pwa-192-v4.png",
    badge: "/icons/bm-training-pwa-192-v4.png",
    tag: data.tag,
    data: { url: data.url },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "/portal#logros", self.location.origin).href;
  event.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((client) => new URL(client.url).origin === self.location.origin);
    if (existing) return existing.navigate(target).then(() => existing.focus());
    return clients.openWindow(target);
  }));
});
