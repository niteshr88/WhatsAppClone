self.addEventListener("push", (event) => {
  let payload = {};

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = {
        body: event.data.text()
      };
    }
  }

  const title = payload.title || "Sandesaa";
  const options = {
    body: payload.body || "New message",
    icon: payload.icon || undefined,
    badge: payload.badge || payload.icon || undefined,
    tag: payload.tag || undefined,
    data: payload.data || { url: "/chat" }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url || "/chat";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existingClient = clients[0];

      if (existingClient) {
        return existingClient.navigate(url).then(() => existingClient.focus());
      }

      return self.clients.openWindow(url);
    })
  );
});

