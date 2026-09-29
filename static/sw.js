const CACHE_NAME = 'portal-estudiantil-v1-core-7';
const SHELL = [
  '/', '/manifest.json', '/static/css/main.css', '/static/css/components.css',
  '/static/css/notas.css', '/static/css/agenda.css', '/static/css/horario.css',
  '/static/css/v1.css', '/static/icon-192.png', '/static/icon-512.png'
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
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok && ['document','script','style','image'].includes(event.request.destination)) {
      const responseToCache = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
    }
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match('/'))));
});
