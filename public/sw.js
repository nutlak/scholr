// Minimal push-only service worker. No caching/offline strategy here — this
// exists solely to receive web push events while scholr isn't in the
// foreground and turn them into an OS notification.

self.addEventListener("push", (event) => {
  let data = { title: "Scholr", body: "" };
  try { data = { ...data, ...event.data.json() }; } catch { /* non-JSON payload — use defaults */ }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/scholr-logo-final.png",
      badge: "/scholr-logo-final.png",
      tag: "scholr-friend-studying", // collapse repeats into one notification
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      return self.clients.openWindow("/app");
    })
  );
});
