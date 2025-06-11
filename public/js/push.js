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
  // انتظر SW فعّال
  const reg = await navigator.serviceWorker.ready;
  console.log('✅ Using active SW at', reg.scope);

  // افتح Firebase
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // إذن
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('❌ Notification permission denied');
    return;
  }

  // اشتراك FCM
  const token = await messaging.getToken({
    vapidKey: VAPID_PUBLIC_KEY,
    serviceWorkerRegistration: reg
  });
  if (!token) {
    console.warn('❌ Failed to get token');
    return;
  }
  console.log('✅ FCM token:', token);

  // أرسل التوكن للخادم
  await fetch('/api/register-token', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ user: window.currentUser, token })
  });
  console.log('✅ Token registered');

  // استمع للإشعارات أثناء foreground
  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    if (title) new Notification(title,{ body });
  });
}

window.initPush = initPush;
