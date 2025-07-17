// public/firebase-messaging-sw.js

// 1) استيراد مكتبات Firebase في الـ SW
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// 2) تهيئة تطبيق Firebase مرة واحدة
firebase.initializeApp({
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
});

// 3) الحصول على Messaging instance
const messaging = firebase.messaging();

// 4) تجاوز مرحلة waiting وتبنّي الـ clients المفتوحة فوراً
self.addEventListener('install',  evt => { self.skipWaiting(); });
self.addEventListener('activate', evt => { evt.waitUntil(self.clients.claim()); });

// 5) التعامل مع الرسائل في الخلفية
messaging.onBackgroundMessage(payload => {
  const { title = 'Notification', body = '' } = payload.notification || {};
  if (!title) return;

  self.registration.showNotification(title, {
    body,
    icon: '/assets/icon.png',
    vibrate: [100, 200, 100],
    data: payload.data  // إذا احتجت بيانات إضافية عند النقر مثلاً
  });
});
