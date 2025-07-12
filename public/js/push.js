// public/js/push.js
// —————————————————————————————————————————
// هذا الملف يعمل كـ module
// —————————————————————————————————————————

// 1) استيراد الـ SDK
import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getMessaging,
  getToken,
  onMessage
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js';

// 2) إعداداتك
const API_BASE       = 'https://dwam-app-by-omar.onrender.com/api';
const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};
const VAPID_KEY      = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// 3) ضبط Firebase لمرة واحدة
if (!getApps().length) {
  initializeApp(firebaseConfig);
}
const messaging = getMessaging();

// 4) تهيئة الويب بوش
export async function initPushWeb() {
  if (!('serviceWorker' in navigator)) {
    console.warn('🚫 لا يوجد دعم Service Worker');
    return;
  }
  // 4.1 تسجيل SW
  let reg;
  try {
    reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW registered:', reg.scope);
  } catch (e) {
    console.error('❌ SW registration failed:', e);
    return;
  }
  // 4.2 إذن إشعارات
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    console.warn('🔕 إذن الإشعارات مرفوض');
    return;
  }
  // 4.3 احصل على التوكن
  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: reg
    });
    console.log('✅ FCM Token:', token);
    if (token && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ Token sent to server');
    }
  } catch (e) {
    console.warn('⚠️ Unable to get/send FCM token:', e);
  }
  // 4.4 استمع للرسائل
  onMessage(messaging, payload => {
    const { title, body } = payload.notification || {};
    if (title && body && Notification.permission === 'granted') {
      new Notification(title, { body });
      window.addNotification({ title, body, time: new Date().toLocaleString() });
    }
  });
}

// 5) دمج الويب والـ native (Capacitor) لو احتجت
export async function initPush() {
  await initPushWeb();
  // لو كنت تستخدم native يمكنك هنا استدعاء initPushNative()
  // await initPushNative();
}
