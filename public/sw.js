// balanx Service Worker — Web Push only.
// Intentionally NO fetch caching: we never want to serve stale UI/code from the SW.
// HTML is always revalidated by the network thanks to the no-cache headers on index.html.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = { title: 'balanx', body: 'Você tem novidades', url: '/' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {
    if (event.data) payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon-light.svg',
      badge: '/favicon-light.svg',
      data: { url: payload.url || '/' },
      tag: payload.tag || 'balanx',
      renotify: true,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if ('focus' in client) {
        client.navigate(targetUrl).catch(() => {});
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  })());
});
