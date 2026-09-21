// Service worker: web push, plus the minimum needed to be installable.
//
// Chrome will not offer "Install app" without a fetch handler that can answer
// a navigation while offline, so there is one — but deliberately the most
// conservative kind. It is network-first and caches nothing but a static
// offline page. A worker that serves cached HTML while online is how a PWA
// pins someone to last week's build, and there is no way for them to force a
// refresh once it has.
const SHELL = "scholr-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL)
      .then((c) => c.add(OFFLINE_URL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Only navigations, only as a fallback. Everything else — the JS, the CSS, the
// API — goes straight to the network as if no worker existed.
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});

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
