self.addEventListener("push", (event) => {
  const fallback = {
    title: "New activity in Syncret",
    body: "A friend sent something new.",
    url: "/",
    tag: "syncret-activity",
  };

  let payload = fallback;
  try {
    if (event.data) {
      payload = { ...fallback, ...event.data.json() };
    }
  } catch {
    payload = fallback;
  }

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      const visibleClient = windows.some(
        (client) => client.visibilityState === "visible",
      );

      if (visibleClient) return;

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/syncret-logo.svg",
        badge: "/syncret-logo.svg",
        tag: payload.tag,
        renotify: false,
        data: {
          url: payload.url || "/",
        },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of windows) {
        if ("focus" in client) {
          if ("navigate" in client) {
            await client.navigate(targetUrl);
          }
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })(),
  );
});
