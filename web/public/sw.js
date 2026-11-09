/* KubeCompanion service worker (hand-written, no Workbox).
   precache shell on install; cache-first for hashed assets; network-first for navigations with an
   offline fallback; /api/* and *.dash0.com are never touched. */
importScripts('/sw-should-handle.js');

var CACHE = 'kc-shell-v1';
var SHELL = [
  '/',
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/sw-should-handle.js',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches
      .open(CACHE)
      .then(function (c) {
        return c.addAll(SHELL);
      })
      .then(function () {
        return self.skipWaiting();
      }),
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys
            .filter(function (k) {
              return k !== CACHE;
            })
            .map(function (k) {
              return caches.delete(k);
            }),
        );
      })
      .then(function () {
        return self.clients.claim();
      }),
  );
});

self.addEventListener('fetch', function (event) {
  var req = event.request;
  if (req.method !== 'GET') return;
  if (!shouldHandle(req.url, self.location.origin)) return; // no respondWith: browser handles it

  var url = new URL(req.url);
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(function (res) {
          if (res.ok) {
            var copy = res.clone();
            event.waitUntil(
              caches.open(CACHE).then(function (c) {
                return c.put('/', copy);
              }),
            );
          }
          return res;
        })
        .catch(function () {
          return caches.match('/').then(function (r) {
            return r || caches.match('/offline.html');
          });
        }),
    );
    return;
  }

  if (url.pathname.indexOf('/assets/') === 0) {
    event.respondWith(
      caches.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res.ok) {
            var copy = res.clone();
            event.waitUntil(
              caches.open(CACHE).then(function (c) {
                return c.put(req, copy);
              }),
            );
          }
          return res;
        });
      }),
    );
    return;
  }

  // other same-origin GETs (icons, manifest): cache first, then network
  event.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req);
    }),
  );
});
