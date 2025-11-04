diff --git a/xp-tracker/sw.js b/xp-tracker/sw.js
new file mode 100644
index 0000000000000000000000000000000000000000..b287f37b933ba255c543c3631c43409649e4acb8
--- /dev/null
+++ b/xp-tracker/sw.js
@@ -0,0 +1,65 @@
+const CACHE_NAME = "xp-tracker-v1";
+const APP_SHELL = [
+  "./",
+  "./index.html",
+  "./styles.css",
+  "./app.js",
+  "./manifest.json",
+  "./icons/xp-192.png",
+  "./icons/xp-512.png"
+];
+const CDN_PREFIX = "https://cdn.jsdelivr.net/";
+
+self.addEventListener("install", (event) => {
+  event.waitUntil(
+    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
+  );
+  self.skipWaiting();
+});
+
+self.addEventListener("activate", (event) => {
+  event.waitUntil(
+    caches.keys().then((keys) =>
+      Promise.all(
+        keys
+          .filter((key) => key !== CACHE_NAME)
+          .map((key) => caches.delete(key))
+      )
+    )
+  );
+  self.clients.claim();
+});
+
+self.addEventListener("fetch", (event) => {
+  const { request } = event;
+  if (request.method !== "GET") {
+    return;
+  }
+
+  if (request.url.startsWith(CDN_PREFIX)) {
+    event.respondWith(cacheFirst(request));
+    return;
+  }
+
+  if (request.mode === "navigate") {
+    event.respondWith(
+      fetch(request).catch(() => caches.match("./index.html"))
+    );
+    return;
+  }
+
+  event.respondWith(
+    caches.match(request).then((cached) => cached || fetch(request))
+  );
+});
+
+async function cacheFirst(request) {
+  const cache = await caches.open(CACHE_NAME);
+  const cached = await cache.match(request);
+  if (cached) {
+    return cached;
+  }
+  const response = await fetch(request);
+  cache.put(request, response.clone());
+  return response;
+}
