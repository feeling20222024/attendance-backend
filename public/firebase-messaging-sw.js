// public/firebase-messaging-sw.js

// 1) استيراد مكتبات الـ Compat داخل SW
importScripts(
 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js',
 'https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js'
);

// 2) تهيئة تطبيق Firebase (مطابق للويب)
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
  const { title='Notification', body='' } = payload.notification || {};
  const time = new Date().toLocaleString();

  // 1) إبقاء عرض الإشعار النظامي
  self.registration.showNotification(title, { body });

  // 2) إرسال رسالة إلى الـ page clients ليخزّنها notifications.js
  self.clients.matchAll().then(clients => {
    for (const client of clients) {
      client.postMessage({
        type:  'NEW_NOTIFICATION',
        title,
        body,
        time
      });
    }
  });
});

self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', evt => evt.waitUntil(self.clients.claim()));
