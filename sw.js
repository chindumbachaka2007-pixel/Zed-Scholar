// ZED SCHOLAR - Service Worker V30 - TRULY MANUAL UPDATE
// Bump this version every time you push a new build
// v30 = MANUAL update release. Nothing updates until the user taps "Tap to Update Now".
//
// RULE: This SW must NEVER call skipWaiting() on its own.
// - install: new SW installs and goes into WAITING state. It does NOT take over.
// - activate: only runs AFTER the user taps Update -> page sends SKIP_WAITING -> skipWaiting() runs.
// - clients.claim() in activate is SAFE: activate only happens after that manual tap.
const CACHE_NAME = 'zed-scholar-v30';
const CACHE_VERSION = 'v30';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// 1. INSTALL - cache new files, then WAIT. Do NOT take over yet.
self.addEventListener('install', (event) => {
  console.log('[SW] Install', CACHE_VERSION, '- WAITING for user to tap Update, NOT taking over');
  // NO self.skipWaiting() here - this is what makes it truly manual.
  // The new SW stays in "waiting" until the page sends {type:'SKIP_WAITING'}.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => console.log('[SW] Could not cache', url, err))
        )
      );
    })
  );
});

// 2. ACTIVATE - only runs after user tapped Update. Delete old caches, then take control.
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate', CACHE_VERSION, '- user tapped Update, taking over now');
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
      return self.clients.claim(); // Safe here: we are already activated by the manual tap
    })
  );
});

// 3. FETCH - Network first for HTML (so updates show fast), Cache first for others
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) return;

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

// MANUAL UPDATE ONLY: page sends this when user taps "Tap to Update Now".
// This is the ONLY place skipWaiting() is allowed to run.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] User tapped Update - skipWaiting now');
    self.skipWaiting();
  }
});
