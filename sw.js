// ZED SCHOLAR - Service Worker V35 - TRULY MANUAL UPDATE
// v35 = Install button fix + blank-space fix + TOP install banner + CENTERED update popup + MANUAL update. Nothing updates until user taps Update.
const CACHE_NAME = 'zed-scholar-v6';
const CACHE_VERSION = 'v6';
const ASSETS_TO_CACHE = ['./','./index.html','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install', (event) => {
  console.log('[SW] Install', CACHE_VERSION, '- WAITING for user to tap Update, NOT taking over');
  // NO self.skipWaiting() here - truly manual.
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(ASSETS_TO_CACHE.map((url) => cache.add(url).catch((err) => console.log('[SW] Could not cache', url, err))));
    })
  );
});
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate', CACHE_VERSION, '- user tapped Update, taking over now');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => { if (key !== CACHE_NAME) return caches.delete(key); }));
    }).then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension')) return;
  if (event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (event.request.url.includes('supabase') || event.request.url.includes('youtube') || event.request.url.includes('ytimg')) return res;
        const clone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return res;
      });
    }).catch(() => caches.match('./index.html'))
  );
});
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('[SW] User tapped Update - skipWaiting now');
    self.skipWaiting();
  }
});
