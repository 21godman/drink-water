/* global self, URL */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title =
    typeof payload.title === "string" ? payload.title : "喝水時間到了";
  const body =
    typeof payload.body === "string"
      ? payload.body
      : "補充一杯水，照顧今天的自己。";
  const targetUrl = new URL(
    typeof payload.url === "string" ? payload.url : "./",
    self.registration.scope,
  ).href;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag:
        typeof payload.tag === "string"
          ? payload.tag
          : "drink-water-reminder",
      icon: new URL("icons/pwa-192x192.png", self.registration.scope).href,
      badge: new URL("icons/pwa-192x192.png", self.registration.scope).href,
      data: { url: targetUrl },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl =
    typeof event.notification.data?.url === "string"
      ? event.notification.data.url
      : self.registration.scope;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if ("navigate" in client) await client.navigate(targetUrl);
          if ("focus" in client) return client.focus();
        }
        return self.clients.openWindow(targetUrl);
      }),
  );
});
