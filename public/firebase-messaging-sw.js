// public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain: "device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket: "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId: "1:235398312189:web:8febe5e63f7b134b808e94"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  const { title='', body='' } = payload.notification||{};
  // هنا تضمن ظهور إشعار نظامي
  self.registration.showNotification(title, {
    body,
    tag: 'default',
    data: payload.data,
    // يمكن أيضًا ضبط click_action لفتح اللوحة
    actions: [{action: 'open_notifications', title: 'فتح سجل الإشعارات'}]
  });
});

// استمع لنقرة الإشعار وابعث رسالة للصفحة لفتح اللوحة
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clientsArr => {
      const client = clientsArr.find(c => c.visibilityState==='visible');
      if (client) {
        client.postMessage({ action: 'openNotifications' });
        client.focus();
      } else {
        // إذا لم تكن أي نافذة مفتوحة، افتح التطبيق
        self.clients.openWindow('/');
      }
    })
  );
});
