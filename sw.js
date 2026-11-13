/* ZED SCHOLAR - Offline Service Worker - SILENT, no offline banner */
const CACHE = 'zed-scholar-v5';
const PRECACHE = [
  './',
  './index.html',
  './ZED-SCHOLAR-fixed.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      // Cache each file that exists - if one 404s, don't fail the whole install
      for (const url of PRECACHE) {
        try { await cache.add(url); } catch (err) {}
      }
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
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

  // API calls - network only, never cache. If offline they fail silently,
  // the app already shows its normal empty state / saved papers.
  if (isApi(url)) return;

  // Navigation - open the app itself: network first, fall back to cached app shell
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    e.respondWith(
      fetch(req).then((res) => {
        // Save a fresh copy for next offline open
        try {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy)).catch(() => {});
          // Also keep the fixed filename in sync if this IS that file
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
        // Last resort - still return something, never a blank browser error page
        return new Response('<h1 style="font-family:sans-serif;padding:20px">ZED SCHOLAR</h1><p style="font-family:sans-serif;padding:0 20px">Open once with data, then it works offline.</p>', { headers: { 'Content-Type': 'text/html' } });
      })
    );
    return;
  }

  // Everything else (CSS, JS, images, fonts, PDF.js, Tailwind CDN) - show cached copy instantly, update in background
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
      // If we have a cached copy, return it now and update in background. If not, wait for network.
      return cached || network.then((r) => r || new Response('', { status: 504 }));
    })
  );
});
