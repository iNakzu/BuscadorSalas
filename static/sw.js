const CACHE_NAME = 'portal-estudiantil-v1-core-35';
const SHELL = [
  '/', '/manifest.json', '/static/css/main.css', '/static/css/components.css',
  '/static/css/notas.css', '/static/css/agenda.css', '/static/css/horario.css',
  '/static/css/v1.css', '/static/icon-192.png', '/static/icon-512.png',
  '/static/notification-empty-icon.png', '/static/notification-status-badge-v2.png'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.includes('/auth/')) return;
  // OAuth PKCE callbacks and other query-bearing pages must never be persisted
  // in Cache Storage, where their authorization code could outlive the redirect.
  if (url.search) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && ['document','script','style','image'].includes(event.request.destination)) {
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
    }
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match('/'))));
});

self.addEventListener('push', event => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch (_) { payload = {}; }
  const title = typeof payload.title === 'string' ? payload.title.slice(0, 80) : 'Portal Estudiantil';
  const body = typeof payload.body === 'string' ? payload.body.slice(0, 180) : 'Tienes un nuevo recordatorio.';
  const path = typeof payload.url === 'string' && /^\/(?:#|\?)/.test(payload.url) ? payload.url : '/';
  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/static/notification-empty-icon.png',
    badge: '/static/notification-status-badge-v2.png',
    tag: typeof payload.tag === 'string' ? payload.tag.slice(0, 100) : 'portal-reminder',
    renotify: false,
    requireInteraction: true,
    silent: false,
    vibrate: [160, 80, 160],
    data: { path }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const path = event.notification.data && event.notification.data.path || '/';
  const requested = new URL(path, self.location.origin);
  const destination = requested.origin === self.location.origin && requested.pathname === '/'
    ? requested.href
    : new URL('/', self.location.origin).href;
  event.waitUntil((async () => {
    // On Android, let Chrome route an in-scope URL to the installed standalone PWA.
    // A generic same-origin tab may exist alongside the PWA and should not win.
    if (/Android/i.test(self.navigator.userAgent || '')) {
      try {
        const appWindow = await self.clients.openWindow(destination);
        if (appWindow) {
          await appWindow.focus();
          return;
        }
      } catch (_) {
        // Fall back to an existing same-origin client if Android cannot open a window.
      }
    }
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = clients.find(client => new URL(client.url).origin === self.location.origin);
    if (existing) {
      try {
        const navigated = await existing.navigate(destination);
        if (navigated) {
          await navigated.focus();
          return;
        }
      } catch (_) {
        // Fall through to opening the target if the existing window cannot be navigated.
      }
    }
    await self.clients.openWindow(destination);
  })());
});
