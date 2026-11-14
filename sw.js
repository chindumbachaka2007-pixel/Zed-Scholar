/* ZED SCHOLAR - Service Worker - PUSH UPDATES TO USERS
   HOW IT WORKS:
   1. You upload a new HTML + this sw.js together.
   2. The app checks for a new sw.js every hour + on every open.
   3. When it finds a new version, it shows the green "NEW UPDATE AVAILABLE - Tap to Update Now" banner.
   4. User taps -> app sends SKIP_WAITING -> this SW takes over -> app reloads with the new version.
   5. User stays on the OLD version until they tap. Nothing auto-reloads.

   TO PUSH YOUR NEXT UPDATE:
   - Change CACHE below from 'zed-scholar-v27' to 'zed-scholar-v28' (then v29, v30...)
   - Upload the new HTML + this sw.js together. If you only upload HTML and forget sw.js, users will NOT get the update.
*/
const CACHE = 'zed-scholar-v27';
const PRECACHE = [
  './',
  './index.html',
  './ZED-SCHOLAR-fixed.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// INSTALL - cache the app shell, but DO NOT skipWaiting yet.
// We wait for the user to tap "Tap to Update Now" in the app.
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      for (const url of PRECACHE) {
        try { await cache.add(url); } catch (err) {}
      }
    })
    // NO self.skipWaiting() here on purpose - user must tap Update first
  );
});

// ACTIVATE - delete ALL old caches, then take control
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// MESSAGE FROM THE APP - "Tap to Update Now" button sends this
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  // App can also ask "is there an update?" - reply with our version
  if (e.data && e.data.type === 'GET_VERSION') {
    e.source && e.source.postMessage({ type: 'VERSION', version: CACHE });
  }
});

function isApi(url) {
  return url.hostname.includes('supabase.co')
    || url.hostname.includes('generativelanguage.googleapis.com')
    || url.hostname.includes('googleapis.com')
    || url.hostname.includes('firebase')
    || url.hostname.includes('analytics')
    || url.hostname.includes('googletagmanager');
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // API calls - network only, never cache
  if (isApi(url)) return;

  // Navigation - opening the app itself: NETWORK FIRST so users always get the newest HTML when they have data.
  // If offline, fall back to cached app shell.
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req).then((res) => {
        try {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          if (req.url.includes('ZED-SCHOLAR')) {
            caches.open(CACHE).then((c) => c.put(req, res.clone())).catch(() => {});
          }
        } catch (err) {}
        return res;
      }).catch(async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(req, { ignoreSearch: true })
          || await cache.match('./index.html')
          || await cache.match('./ZED-SCHOLAR-fixed.html')
          || await cache.match('./');
        if (cached) return cached;
        return new Response('<h1 style="font-family:sans-serif;padding:20px">ZED SCHOLAR</h1><p style="font-family:sans-serif;padding:0 20px">Open once with data, then it works offline.</p>', { headers: { 'Content-Type': 'text/html' } });
      })
    );
    return;
  }

  // Everything else (CSS, JS, images, fonts, PDF.js, Tailwind) - show cached copy instantly, update in background
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200 && (url.origin === self.location.origin || url.hostname.includes('cdnjs') || url.hostname.includes('cdn') || url.hostname.includes('fonts') || url.hostname.includes('tailwind'))) {
          try {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          } catch (err) {}
        }
        return res;
      }).catch(() => null);
      return cached || network.then((r) => r || new Response('', { status: 504 }));
    })
  );
});
