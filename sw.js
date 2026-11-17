// ZED SCHOLAR - MANUAL-UPDATE Service Worker V29
// MANUAL UPDATE ONLY: This SW will NEVER auto-update.
// It downloads the new version in the background, then WAITS.
// It only activates when the user taps "Update Now" in the prompt.
// Bump CACHE_NAME + CACHE_VERSION every time you push a new build.
const CACHE_NAME = 'zed-scholar-v29-manual';
const CACHE_VERSION = 'v29';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  // './icon-192.png',
  // './icon-512.png'
];

// 1. INSTALL - cache new files, but DO NOT take over.
// NO skipWaiting() here on purpose. New SW stays in "waiting" state
// until the user clicks Update.
self.addEventListener('install', (event) => {
  console.log('[SW] Install - new version downloaded, WAITING for user to tap Update', CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Do NOT auto-activate here - that would auto-update
});

// 2. ACTIVATE - only runs AFTER user taps Update (SKIP_WAITING).
// Then we delete old caches and take control.
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate - user approved update', CACHE_VERSION);
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
      // Now that user approved, take control immediately
      return self.clients.claim();
    })
  );
});

// 3. FETCH - Serve OLD cached version until user updates.
// IMPORTANT: HTML is CACHE-FIRST here, not network-first.
// Network-first would show the new HTML automatically on next navigation,
// which defeats "wait for user to click Update".
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) return;

  // For HTML pages - serve from cache (old version) until user updates.
  // If no cache yet (first visit), go to network.
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((res) => {
          // Only cache if this is the current version's fetch (first load)
          // Don't overwrite cache with new HTML while waiting - that would leak the update.
          return res;
        }).catch(() => {
          return caches.match('./index.html');
        });
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
        // Only cache same-origin static assets, and only if response is ok
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      }).catch(() => cached);
    })
  );
});

// 4. MESSAGE - only way to activate new version is user tapping Update
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] User tapped Update - activating new version');
    self.skipWaiting();
  }
});
