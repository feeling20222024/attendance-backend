// 0) Firebase-compat + FCM compat
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

// 1) إشعارات الخلفية
messaging.onBackgroundMessage(payload => {
  const { title='', body='' } = payload.notification||{};
  const timestamp = Date.now();

  // (a) عرضها
  self.registration.showNotification(title, { body });

  // (b) بعثها لكل النوافذ
  self.clients.matchAll({ includeUncontrolled: true }).then(clients=>{
    clients.forEach(c => c.postMessage({ 
      type:'NEW_NOTIFICATION', title, body, timestamp 
    }));
  });
});

// 2) Cache لحالة SPA
const CACHE_NAME = 'v1';
const ASSETS = ['/', '/index.html', '/css/style.css', '/js/app.js', '/js/push.js'];

self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE_NAME)
    .then(c=>c.addAll(ASSETS))
    .then(()=>self.skipWaiting()));
});

self.addEventListener('activate', e=> e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', e=>{
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;
  e.respondWith(caches.match(e.request).then(c=>c || fetch(e.request)));
});
