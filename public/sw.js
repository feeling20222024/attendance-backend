const CACHE_NAME  = 'dwam-cache-v2';
const OFFLINE_URL = '/offline.html';
const ASSETS = [
  '/', '/index.html', '/offline.html',
  '/css/style.css', '/js/app.js', '/js/push.js',
  '/assets/icon.png',
  // أضف بقية المسارات الثابتة لديك هنا
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(ASSETS)
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).catch(() =>
        caches.match(OFFLINE_URL)
      );
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => key !== CACHE_NAME ? caches.delete(key) : null)
      )
    ).then(() => self.clients.claim())
  );
});
