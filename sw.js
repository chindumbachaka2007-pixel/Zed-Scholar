var CACHE_NAME = 'zed-scholar-v2';
var RUNTIME_CACHE = 'zed-scholar-runtime-v2';
var PDF_CACHE = 'zed-scholar-pdfs-v2';
var PRECACHE_URLS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      var chain = Promise.resolve();
      PRECACHE_URLS.forEach(function (url) {
        chain = chain.then(function () {
          return cache.add(url).catch(function () {});
        });
      });
      return chain;
    })
  );
});
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.map(function (name) {
          if (name !== CACHE_NAME && name !== RUNTIME_CACHE && name !== PDF_CACHE) {
            return caches.delete(name);
          }
        })
      );
    }).then(function () {
      return self.clients.claim();
    })
  );
});
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;
  var url;
  try { url = new URL(request.url); } catch (e) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (
    url.hostname.indexOf('googlesyndication') !== -1 ||
    url.hostname.indexOf('youtube') !== -1 ||
    url.hostname.indexOf('google-analytics') !== -1 ||
    url.hostname.indexOf('googletagmanager') !== -1
  ) return;
  if (
    url.hostname.indexOf('supabase.co') !== -1 &&
    (url.pathname.indexOf('/auth/') !== -1 || url.pathname.indexOf('/rest/') !== -1)
  ) {
    event.respondWith(fetch(request));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).then(function (net) {
        var copy = net.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          cache.put(request, copy).catch(function () {});
        }).catch(function () {});
        return net;
      }).catch(function () {
        return caches.match(request).then(function (cached) {
          if (cached) return cached;
          return caches.match('/').then(function (home) {
            if (home) return home;
            return caches.match('/index.html');
          });
        }).then(function (cached) {
          if (cached) return cached;
          return new Response(
            '<!doctype html><title>ZED SCHOLAR - Offline</title>' +
            '<body style="font-family:sans-serif;background:#04101F;color:#F5F1E8;padding:32px;text-align:center">' +
            '<h1>ZED SCHOLAR</h1><p>You are offline.</p>' +
            '<p>Open the app once while online, then it works offline.</p>' +
            '<button onclick="location.reload()" style="padding:12px 20px;border-radius:10px;background:#E8C15A;border:none;font-weight:800">Retry</button>' +
            '</body>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
    );
    return;
  }
  if (url.hostname.indexOf('supabase.co') !== -1 && url.pathname.indexOf('/storage/') !== -1) {
    event.respondWith(
      fetch(request).then(function (net) {
        var copy = net.clone();
        caches.open(PDF_CACHE).then(function (cache) {
          cache.put(request, copy).catch(function () {});
        }).catch(function () {});
        return net;
      }).catch(function () {
        return caches.match(request);
      })
    );
    return;
  }
  if (
    url.origin === self.location.origin ||
    url.hostname.indexOf('cdnjs.cloudflare.com') !== -1 ||
    url.hostname.indexOf('fonts.googleapis.com') !== -1 ||
    url.hostname.indexOf('fonts.gstatic.com') !== -1
  ) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        var fetchPromise = fetch(request).then(function (net) {
          if (net && net.status === 200) {
            var copy = net.clone();
            caches.open(RUNTIME_CACHE).then(function (cache) {
              cache.put(request, copy).catch(function () {});
            }).catch(function () {});
          }
          return net;
        }).catch(function () { return null; });
        if (cached) { fetchPromise.catch(function () {}); return cached; }
        return fetchPromise.then(function (net) {
          if (net) return net;
          throw new Error('offline');
        });
      })
    );
    return;
  }
  event.respondWith(
    fetch(request).catch(function () { return caches.match(request); })
  );
});
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (var i = 0; i < list.length; i++) {
        if ('focus' in list[i]) return list[i].focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/');
    })
  );
});
