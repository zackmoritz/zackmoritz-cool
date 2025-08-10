const CACHE_NAME = 'lrpm-cache-6.4-1754773221';
const ASSETS = [
  '/',
  '/index.html?v=6.4-1754773221',
  '/manifest.json?v=6.4-1754773221',
  '/service-worker.js?v=6.4-1754773221',
  '/icons/icon-192.png?v=6.4-1754773221',
  '/icons/icon-512.png?v=6.4-1754773221'
];
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)))
  );
  self.clients.claim();
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy));
        return r;
      }).catch(() => caches.match('/index.html')))
    );
  }
});
