/* sw.js - StreamFinder PWA Service Worker */
const CACHE_NAME = 'streamfinder-v1';
const CORE_ASSETS = [
  '/',
  '/Pages/index.html',
  '/Pages/movies.html',
  '/Pages/series.html',
  '/Pages/contact.html',
  '/Pages/p_search.html',
  '/Pages/details.html',
  '/Pages/offline.html',
  '/Style/shared.css',
  '/Style/index.css',
  '/Style/movies.css',
  '/Style/series.css',
  '/Style/contact.css',
  '/Style/details.css',
  '/Style/search.css',
  '/script/pwa.js',
  '/script/ui/header.js',
  '/script/ui/header-page.js',
  '/script/api/tmdb-global.js',
];

// Install: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: navigation fallback to offline, cache-first for static, network-first for API
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Ignore unsupported schemes like chrome-extension://
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // OPTIONAL (recommended): only cache your own site requests
  // This prevents caching CDN/third-party stuff too.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then((res) => {
          // Only cache successful basic responses
          if (!res || res.status !== 200 || res.type !== "basic") return res;

          const clone = res.clone();
          caches.open("app-cache-v1").then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match("/offline.html"));
    })
  );
});

