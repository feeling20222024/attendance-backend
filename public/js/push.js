// public/js/push.js

// —————————————————————————————————————————
// إعدادات Firebase — ضع هنا كامل المفاتيح كما في الـ SW
// —————————————————————————————————————————
const firebaseConfig = {
  apiKey: "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain: "device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket: "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId: "1:235398312189:web:8febe5e63f7b134b808e94"
};

const VAPID_PUBLIC_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// —————————————————————————————————————————
// تهيئة إشعارات الويب عبر FCM
// —————————————————————————————————————————
async function initPush() {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  console.log('✅ Using active SW at', reg.scope);

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  const p = await Notification.requestPermission();
  if (p !== 'granted') return console.warn('❌ no permission');

  const token = await messaging.getToken({
    vapidKey: VAPID_PUBLIC_KEY,
    serviceWorkerRegistration: reg
  });
  console.log('✅ FCM token:', token);

  // سجل التوكن على الخادم…
  // …
}
window.initPush = initPush;
