// Service Worker for Reign — v1.2.19
const CACHE_NAME = 'reign-cache-v1-2-19';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.map(k => k!==CACHE_NAME ? caches.delete(k) : null))));
  self.clients.claim();
});
// Network-first for HTML; cache-first for others
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const isHTML = req.headers.get('accept')?.includes('text/html');
  if (isHTML) {
    event.respondWith(
      fetch(req).then(res => { caches.open(CACHE_NAME).then(c=>c.put(req, res.clone())); return res; })
                .catch(() => caches.match(req))
    );
  } else {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => { caches.open(CACHE_NAME).then(c=>c.put(req,res.clone())); return res; }))
    );
  }
});