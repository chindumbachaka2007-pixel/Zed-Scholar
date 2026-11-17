// ZED SCHOLAR - Service Worker V29
// Bump this version every time you push a new build - this FORCES update check
// v29 = install-prompt release (persistent Install banner in index.html)
// NOTE: The SW alone CANNOT show the install prompt.
// Chrome fires `beforeinstallprompt` in the PAGE. The banner code lives in index.html
// and talks to this SW. This SW just makes the app installable + offline.
const CACHE_NAME = 'zed-scholar-v29';
const CACHE_VERSION = 'v29';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 1. INSTALL - cache new files and force new SW to take over immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Install', CACHE_VERSION);
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll fails if ONE file 404s - cache one-by-one so a missing icon doesn't kill install
      return Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => console.log('[SW] Could not cache', url, err))
        )
      );
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
      return self.clients.claim();
    })
  );
});

// 3. FETCH - Network first for HTML (so updates show fast), Cache first for others
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) return;

  // For HTML pages - try network first, fall back to cache
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return res;
        })
        .catch(() => {
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
        if (event.request.url.includes('supabase') || event.request.url.includes('youtube') || event.request.url.includes('ytimg')) {
          return res;
        }
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});

// Allow page to trigger skipWaiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
