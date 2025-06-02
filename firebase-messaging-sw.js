/**
 * public/firebase-messaging-sw.js
 *
 * خدمة عامل Firebase Messaging (Web Push) لتلقّي الإشعارات حتى وإن كان التابع مغلقاً.
 * نستخدم نسخ “compat” من Firebase App و Firebase Messaging عبر importScripts.
 */

// 1) نحمل مكتبات Firebase “compat” (الإصدار 9.x.x)
// تأكد أنّ رقم الإصدار يتطابق مع ما رعّدته في index.html (أدناه).
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

// 2) تهيئة تكوين الـ Firebase (استبدل القيم بالقيم الحقيقية لديك من Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain: "device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket: "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId: "1:235398312189:web:8febe5e63f7b134b808e94"
  // measurementId: (اختياريّ)
};

// 3) تهيئة تطبيق Firebase داخل Service Worker
firebase.initializeApp(firebaseConfig);

// 4) الحصول على Messaging instance في سياق الـ Service Worker
const messaging = firebase.messaging();

// 5) البقاء في الخدمة لتلقّي الإشعارات عندما يكون التطبيق في خلفية المتصفّح
messaging.onBackgroundMessage(payload => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // بإمكانك هنا تعديل وكيفية عرض الإشعار؛ مثال:
  if (payload.notification) {
    const { title, body } = payload.notification;
    self.registration.showNotification(title, { body });
  }
});
