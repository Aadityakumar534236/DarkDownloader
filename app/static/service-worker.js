const CACHE_NAME = "darkdownloader-shell-v3";
const SHELL_ASSETS = [
  "/",
  "/download",
  "/batch",
  "/history",
  "/sources",
  "/settings",
  "/help",
  "/privacy",
  "/copyright",
  "/static/css/styles.css",
  "/static/js/app.js",
  "/static/js/theme-init.js",
  "/static/icons/favicon.svg",
  "/manifest.webmanifest"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || /\/jobs\/[^/]+\/download$/.test(url.pathname)) return;
  if (event.request.method !== "GET") return;
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
