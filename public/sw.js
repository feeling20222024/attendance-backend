// sw.js

// —————————————————————————————————————————
// 1) استيراد مكتبات Firebase Messaging في الـ SW
// —————————————————————————————————————————
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// —————————————————————————————————————————
// 2) تهيئة Firebase (نفس الإعدادات في firebase-messaging-sw.js)
// —————————————————————————————————————————
firebase.initializeApp({
  apiKey:    "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:"device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket:"device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:     "1:235398312189:web:8febe5e63f7b134b808e94"
});

// —————————————————————————————————————————
// 3) ضبط SW للإشعارات كي يتبنّى النوافذ فوراً
// —————————————————————————————————————————
self.addEventListener('install', evt => {
  self.skipWaiting();
});
self.addEventListener('activate', evt => {
  evt.waitUntil(self.clients.claim());
});

// —————————————————————————————————————————
// 4) إعداد الـ Cache
// —————————————————————————————————————————
const CACHE_NAME = 'attendance-cache-v1';
const ASSETS = [
  '/',                     // index.html
  '/css/style.css',
  '/js/app.js',
  '/js/push.js',
  '/assets/icon.png',
  // أضف هنا باقي الأصول الثابتة (صور، خطوط، إلخ)
];

self.addEventListener('install', evt => {
  evt.waitUntil(
   caches.open(CACHE_NAME).then(cache => {
  // تجنّب طلبات chrome-extension:
  if (event.request.url.startsWith(self.location.origin)) {
    cache.put(event.request, responseClone);
  }
   }  
});

// —————————————————————————————————————————
// 5) Fetch Handler مع clone()
// —————————————————————————————————————————
self.addEventListener('fetch', evt => {
  evt.respondWith(
    caches.match(evt.request).then(cached => {
      const networkFetch = fetch(evt.request).then(resp => {
        // clone قبل الإرسال إلى الكاش
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(evt.request, clone));
        return resp;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});

// —————————————————————————————————————————
// 6) معالج الرسائل في الخلفية (Background Messages)
// —————————————————————————————————————————
const messaging = firebase.messaging();
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  self.registration.showNotification(title || 'تنبيه جديد', {
    body: body || '',
    icon: '/assets/icon.png'
  });
});
