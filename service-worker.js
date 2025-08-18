// service-worker.js  (updated)
const CACHE_NAME = 'lrpm-cache-v643'; // bump version here
const ASSETS = [
  '/', '/index.html', '/manifest.json',
  '/icons/icon-192.png', '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;

  // Only top-level navigations fall back to index.html
  if (req.mode === 'navigate' && sameOrigin) {
    event.respondWith(
      caches.match('/index.html').then(r => r || fetch('/index.html'))
    );
    return;
  }

  // Don’t cache media (let the server/CDN handle it directly)
  const isMedia = /\.(mov|mp4|m4v|webm|mp3|m4a|wav|ogg)$/i.test(url.pathname);
  if (sameOrigin && isMedia) {
    event.respondWith(fetch(req));
    return;
  }

  // Cache-first for other static assets
  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(net => {
          const copy = net.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
          return net;
        });
      })
    );
  }
});