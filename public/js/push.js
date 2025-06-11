// —————————————————————————————————————————
// نقطتك الأساسية للـ API
// —————————————————————————————————————————
const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';

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

  // لا تُهيّئ Firebase أكثر من مرة
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const messaging = firebase.messaging();

  const p = await Notification.requestPermission();
  if (p !== 'granted') {
    console.warn('❌ no permission');
    return;
  }

  const token = await messaging.getToken({ … });
console.log('✅ FCM token:', token);
try {
  const resp = await fetch(`${API_BASE}/register-token`, { … });
  if (!resp.ok) console.error('❌ register failed:', await resp.text());
  else console.log('✅ token registered on server');
} catch (e) {
  console.error('❌ token send error:', e);
}

  // سجل التوكن على الخادم
  try {
    const resp = await fetch(`${API_BASE}/register-token`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ user: window.currentUser, token })
    });
    if (!resp.ok) {
      console.error('❌ failed to register token on server:', await resp.text());
    } else {
      console.log('✅ تم تسجيل توكن FCM بنجاح على الخادم');
    }
  } catch (e) {
    console.error('❌ error sending token to server:', e);
  }

  // استمع للرسائل في الـ foreground
  messaging.onMessage(payload => {
    console.log('📩 foreground message:', payload);
    const { title, body } = payload.notification || {};
    if (title) new Notification(title, { body });
  });
}

window.initPush = initPush;
