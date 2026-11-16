/* ZED SCHOLAR Service Worker — v7 (14 Nov 2026)
   WHY THIS FILE EXISTS: the app is a single page served from Vercel. Without a
   service worker, going offline means Chrome has nothing to show — "This site
   can't be reached" (ERR_CONNECTION_ABORTED) — because the page itself never
   loads, so none of the app's own offline code ever runs. This worker caches
   the app shell on the first ONLINE visit, then serves it when offline.

   RULE FOR FUTURE CHANGES (the "old must be removed" rule): when you change
   index.html, bump CACHE_NAME below (v7 -> v8) and redeploy BOTH files.
   On activate, this worker deletes EVERY cache that is not the current one,
   so the old version is gone — it can never come back and fight the new one. */

const CACHE_NAME = 'zed-scholar-v13';
const APP_SHELL = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png'];

function addAllSafe(cache, urls) {
  // addAll() fails entirely if ONE file 404s — add one by one so a missing
  // icon can never kill offline mode.
  return Promise.all(urls.map(function (u) {
    return cache.add(u).catch(function () { /* ignore missing file */ });
  }));
}

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return addAllSafe(cache, APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_NAME) return caches.delete(k); // DELETE OLD VERSIONS
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('message', function (e) {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});


// Notification clicks — moved here from a blob-registered worker that Chrome
// rejects (a service worker must be a real file, which this one is).
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (cs) {
      if (cs.length) return cs[0].focus();
      return clients.openWindow('./');
    })
  );
});

self.addEventListener('fetch', function (e) {
  var url;
  try { url = new URL(e.request.url); } catch (err) { return; }
  if (e.request.method !== 'GET') return;

  // NEVER intercept Supabase / API calls. The app handles offline itself
  // (IndexedDB + localStorage). Caching API responses would serve stale
  // coins / unlocks / auth data — worse than no cache.
  if (url.hostname.indexOf('supabase.co') !== -1) return;

  // NAVIGATION (opening the site, refreshing): network first, then the
  // cached app shell. This is what makes offline open work.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put('/index.html', copy); });
        return res;
      }).catch(function () { return caches.match('/index.html'); })
    );
    return;
  }

  // Same-origin static files: serve cache instantly, refresh in background.
  if (url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then(function (cached) {
        var network = fetch(e.request).then(function (res) {
          if (res && res.ok) {
            var copy = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(e.request, copy); });
          }
          return res;
        }).catch(function () { return cached; });
        return cached || network;
      })
    );
    return;
  }

  // CDN files (fonts, Tailwind): network first, fall back to cache.
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res && res.ok) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () { return caches.match(e.request); })
  );
});
