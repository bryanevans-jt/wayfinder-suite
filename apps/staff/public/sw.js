function resolveNotificationUrl(rawUrl) {
  const fallback = self.location.origin + "/dashboard";
  if (!rawUrl) {
    return fallback;
  }
  try {
    const resolved = new URL(rawUrl, self.location.origin);
    if (resolved.origin !== self.location.origin) {
      return fallback;
    }
    return resolved.href;
  } catch {
    return rawUrl.startsWith("/") ? self.location.origin + rawUrl : fallback;
  }
}

function urlPath(url) {
  try {
    return new URL(url).pathname + new URL(url).search;
  } catch {
    return url;
  }
}

self.addEventListener("push", (event) => {
  let data = { title: "Wayfinder", body: "", url: "/dashboard" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    data.body = event.data?.text() ?? "";
  }

  const openUrl = resolveNotificationUrl(data.url);

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icon-512.png",
      badge: "/icon-512.png",
      data: { url: openUrl },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = resolveNotificationUrl(event.notification.data?.url);
  const targetPath = urlPath(targetUrl);

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (urlPath(client.url) === targetPath && "focus" in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
