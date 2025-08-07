// public/sw.js

// 0) استيراد مكتبات Firebase Messaging compat
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            'AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y',
  authDomain:        'device-streaming-47cbe934.firebaseapp.com',
  projectId:         'device-streaming-47cbe934',
  storageBucket:     'device-streaming-47cbe934.appspot.com',
  messagingSenderId: '235398312189',
  appId:             '1:235398312189:web:8febe5e63f7b134b808e94'
});

const messaging = firebase.messaging();

// 1) استماع لرسائل الخلفية من FCM
messaging.onBackgroundMessage(payload => {
  const { title = '', body = '' } = payload.notification || {};
  const timestamp = Date.now();

  // 1.a) عرض الإشعار
  self.registration.showNotification(title, { body });

  // 1.b) إرسالها للصفحات المفتوحة عبر postMessage
  self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type:      'NEW_NOTIFICATION',
        title,
        body,
        timestamp
      });
    });
  });
});

// 2) تعريف قائمة الملفات التي نريد كاشنجها
const CACHE_NAME = 'v1';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/push.js',
  // أضف هنا أي ملفات ثابتة أخرى تحتاجها
];

// 3) تثبيت Service Worker وعمل Cache للـ ASSETS
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 4) تفعيل SW واحتلال الصفحات فورًا
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// 5) اعتراض جميع طلبات الـ fetch للاستجابة من الكاش أولًا
self.addEventListener('fetch', event => {
  const reqUrl = new URL(event.request.url);

  // إذا كان origin مختلف، اترك الطلب يمر (مثلاً API calls)
  if (reqUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request))
  );
});
