// public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

firebase.initializeApp({ /* نفس firebaseConfig */ });
const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  if (title) {
    self.registration.showNotification(title, {
      body,
      icon: '/assets/icon.png',
      vibrate: [100,200,100],
      tag: payload.notification.tag || undefined
    });
  }
});

// 1) إعداد Firebase
firebase.initializeApp({
  apiKey:    "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:"device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket:"device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:     "1:235398312189:web:8febe5e63f7b134b808e94"
});
const messaging = firebase.messaging();

// 2) تجاوز مرحلة waiting وتبنّي النوافذ المفتوحة
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// 3) التعامل مع الإشعارات في الخلفية
messaging.onBackgroundMessage(payload => {
  const { title, body } = payload.notification || {};
  if (title) {
    self.registration.showNotification(title, {
      body,
      icon: '/assets/icon.png',        // أيقونتك
      data: payload.data              // تمرير بيانات إضافية إذا احتجتها
    });
  }
});
