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
      .then(cache => cache.addAll(URLS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // احذف أي cache قديم
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(
        names.filter(name => name !== CACHE_NAME)
             .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // رجّع من الكاش إن وجد، وإلا نفّذ fetch عادي ثم خزّن النتيجة
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then(networkResponse => {
        // خزّن في الكاش لطلبات الموارد الثابتة
        if (event.request.method === 'GET' && URLS_TO_CACHE.includes(new URL(event.request.url).pathname)) {
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, networkResponse.clone()));
        }
        return networkResponse;
      });
    })
  );
});
