/**
 * EcoTrace Service Worker — Cache-first strategy for static assets.
 * Caches CSS, JS, fonts, and images for fast repeat visits.
 * Network-first for HTML pages to ensure fresh content.
 */
const CACHE_NAME = "ecotrace-v1";

const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/calculator.html",
  "/dashboard.html",
  "/tips.html",
  "/map.html",
  "/profile.html",
  "/feed.html",
  "/challenges.html",
  "/css/styles.css",
  "/favicon.png",
  "/js/app.js",
  "/js/config.js",
];

// Install: precache critical assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin API requests
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin &&
      !url.hostname.includes("fonts.googleapis.com") &&
      !url.hostname.includes("fonts.gstatic.com") &&
      !url.hostname.includes("gstatic.com")) {
    return;
  }

  // HTML: Network-first (always fresh content)
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // CSS, JS, Fonts, Images: Cache-first (fast loads)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful responses
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});
