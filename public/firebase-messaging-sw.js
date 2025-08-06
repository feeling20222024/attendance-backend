// public/firebase-messaging-sw.js
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

messaging.onBackgroundMessage(payload => {
  const { title = '', body = '' } = payload.notification || {};
  const timestamp = Date.now();
  // عرض الإشعار
  self.registration.showNotification(title, { body });
  // إرسال للصفحات المفتوحة
  self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
    clients.forEach(client => {
      client.postMessage({ type: 'NEW_NOTIFICATION', title, body, timestamp });
    });
  });
});
