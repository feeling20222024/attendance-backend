// public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
});

const messaging = firebase.messaging();

// تجاوز الانتظار
self.addEventListener('install', evt => self.skipWaiting());
self.addEventListener('activate', evt => evt.waitUntil(self.clients.claim()));

// معالجة الإشعارات الخلفية
messaging.onBackgroundMessage(async payload => {
  const { title = 'إشعار', body = '' } = payload.notification || {};
  const time = new Date().toLocaleString();

  // عرض الإشعار
  self.registration.showNotification(title, {
    body,
    icon: '/assets/icon.png',
    vibrate: [100, 200, 100],
    data: payload.data || {}
  });

  // محاولة إرسال البيانات إلى الصفحة المفتوحة لتخزينها
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) {
    client.postMessage({
      type: 'NEW_NOTIFICATION',
      title,
      body,
      time
    });
  }
});
