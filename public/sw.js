// public/sw.js

const CACHE_NAME = 'attendance-app-cache-v1';
const URLS_TO_CACHE = [
  '/', 
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/push.js',
  '/assets/icon.png',
  // أضف هنا أي ملفات ثابتة أخرى تحتاجها
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // clone قبل أيّ استهلاك
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseClone));
        return networkResponse;
      }).catch(() => cachedResponse);

      // إذا كان في الكاش، أعدّه فورًا، وإلا انتظر الشبكة
      return cachedResponse || fetchPromise;
    })
  );
});
