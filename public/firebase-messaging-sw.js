// public/firebase-messaging-sw.js

// 1) استيراد مكتبات الـ Compat داخل SW
importScripts(
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js'
);

// 2) تهيئة التطبيق
firebase.initializeApp({
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
});

// 3) احصل على Messaging instance
const messaging = firebase.messaging();

// 4) تعامل مع الرسائل في الخلفية
messaging.onBackgroundMessage(payload => {
  const { title = 'إشعار', body = '' } = payload.notification || {};
  self.registration.showNotification(title, {
    body,
    icon: '/assets/icon.png',
    vibrate: [100, 200, 100],
    data: payload.data
  });
});

// 5) اِعتمد العمل فور التثبيت والتفعيل
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', evt => evt.waitUntil(self.clients.claim()));
