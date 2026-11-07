// ZED SCHOLAR - Auto-Update Service Worker V25
// Bump this version every time you push a new build - this FORCES update check
const CACHE_NAME = 'zed-scholar-v3-seo'; // ← NUMBER 1: change v3 to v4 on next push
const CACHE_VERSION = 'v3'; // ← NUMBER 2: change v3 to v4 on next push

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  // Add your icons if you have them
  // './icon-192.png',
  // './icon-512.png'
];

// 1. INSTALL - cache new files and force new SW to take over immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Install', CACHE_VERSION);
  self.skipWaiting(); // IMPORTANT: new SW activates immediately, doesn't wait
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. ACTIVATE - delete old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate', CACHE_VERSION);
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Deleting old cache', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Take control of all pages immediately
    })
  );
});

// 3. FETCH - Network first for HTML (so updates show fast), Cache first for others
self.addEventListener('fetch', (event) => {
  // Skip non-GET and chrome extensions
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) return;

  // For HTML pages - try network first, fall back to cache
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // Update cache with fresh HTML
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => {
          // Offline - serve cached HTML
          return caches.match(event.request).then((cached) => cached || caches.match('./index.html'));
        })
    );
    return;
  }

  // For everything else - cache first, then network
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        // Don't cache supabase, youtube, etc
        if (event.request.url.includes('supabase') || event.request.url.includes('youtube') || event.request.url.includes('ytimg')) {
          return res;
        }
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      });
    })
  );
});

// Allow page to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
