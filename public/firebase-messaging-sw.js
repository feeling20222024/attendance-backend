// public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain: "device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket: "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId: "1:235398312189:web:8febe5e63f7b134b808e94"
};

// 3) تهيئة تطبيق Firebase Messaging
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 4) استقبال الإشعارات عندما يكون التطبيق في الخلفية/مُغلق
messaging.onBackgroundMessage(payload => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const { title, body } = payload.notification || {};
  if (title && body) {
    self.registration.showNotification(title, {
      body,
      // يمكنك إضافة أيقونة أو خيارات إضافية هنا:
      // icon: '/assets/icon.png'
    });
  }
});
