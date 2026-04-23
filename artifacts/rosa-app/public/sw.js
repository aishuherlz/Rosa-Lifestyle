// ROSA service worker — minimal: enables local notifications + future push
const CACHE_NAME = "rosa-shell-v1";

self.addEventListener("install", (event) => { self.skipWaiting(); });
self.addEventListener("activate", (event) => { event.waitUntil(self.clients.claim()); });

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) { client.navigate(urlToOpen); return client.focus(); }
      }
      if (self.clients.openWindow) return self.clients.openWindow(urlToOpen);
    })
  );
});

// Future: push event handler (server-sent push)
self.addEventListener("push", (event) => {
  let data = { title: "ROSA 🌹", body: "A gentle reminder for you", url: "/" };
  try { if (event.data) data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: "/favicon.svg", badge: "/favicon.svg", data: { url: data.url },
  }));
});
