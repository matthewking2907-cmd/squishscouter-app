// Squishscouter service worker: keeps the app's own files so it opens with no signal (showing what it last loaded),
// always trying the network first for a fresh copy; and shows stock alerts sent by the check-stock function.
const CACHE = 'squishscouter-v1';
const SHELL = ['./', './index.html', './manifest.json', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))));
  self.clients.claim();
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // only the app's own files: stock and sign-in replies are never kept by the service worker
  if (new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(event.request, copy));
      return res;
    }).catch(() => caches.match(event.request).then((hit) => hit || caches.match('./index.html')))
  );
});

// An alert: { title, body, url (the product in the shop), image (its photo), tag }
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'Squishscouter', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag, icon: 'icon-192.png', badge: 'icon-192.png',
    image: d.image || undefined, data: { url: d.url || './' }
  }));
});

// Tapping it opens the product in the shop (or the app, for a test).
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || './', self.registration.scope).href;
  const inApp = url.indexOf(self.registration.scope) === 0;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    if (inApp) { for (const c of list) { if (c.url.indexOf(self.registration.scope) === 0 && 'focus' in c) return c.focus(); } }
    return self.clients.openWindow(url);
  }));
});
