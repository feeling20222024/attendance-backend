const CACHE_NAME = 'v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/push.js',
  // ...
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', e => {
  const reqUrl = new URL(e.request.url);

  // إذا الطلب لأصل خارجي (API) فاتركه يمر دون اعتراض
  if (reqUrl.origin !== self.location.origin) {
    return; 
  }

  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request)
    )
  );
});
