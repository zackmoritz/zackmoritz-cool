// sw-lrpm-v646.js  (new name so the browser is forced to fetch it)
const CACHE_NAME = 'lrpm-cache-v646';
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
    caches.keys().then(keys => Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null))))
  );
  self.clients.claim();
});

// Optional: respond to SKIP_WAITING message from the page
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  const sameOrigin = url.origin === location.origin;

  // Treat ONLY top-level navigations as SPA shell
  if (req.mode === 'navigate' && sameOrigin) {
    event.respondWith(
      caches.match('/index.html').then(r => r || fetch('/index.html'))
    );
    return;
  }

  // Bypass media & images entirely (let server/CDN handle, supports Range)
  const isMedia = /\.(mov|mp4|m4v|webm|mp3|m4a|wav|ogg|heic|heif|jpg|jpeg|png|gif|webp)$/i.test(url.pathname);
  if (sameOrigin && isMedia) {
    event.respondWith(fetch(req));
    return;
  }

  // Cache-first for other same-origin requests
  if (sameOrigin) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(net => {
        const copy = net.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return net;
      }))
    );
  }
});