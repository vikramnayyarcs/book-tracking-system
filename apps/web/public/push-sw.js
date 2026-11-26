self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  const title = typeof data.title === "string" ? data.title : "Time to read";
  const url = typeof data.url === "string" ? data.url : "/";
  event.waitUntil(self.registration.showNotification(title, { data: { url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.url, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((windows) => {
      const open = windows[0];
      if (open && "navigate" in open) {
        return open.navigate(url).then((client) => client && client.focus());
      }
      return self.clients.openWindow(url);
    }),
  );
});
