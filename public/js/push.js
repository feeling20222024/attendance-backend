// push.js
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getMessaging,
  getToken,
  onMessage
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js';

const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';
const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};
const VAPID_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// تهيئة Firebase مرة واحدة
if (!getApps().length) initializeApp(firebaseConfig);
const messaging = getMessaging();

// دالة تهيئة الويب
export async function initPush() {
  // 1) تسجيل الـ SW
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW registered:', reg.scope);
  } catch(e) {
    console.warn('❌ SW registration failed:', e);
    return;
  }

  // 2) طلب إذن الإشعارات
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    console.warn('🔕 Notification permission denied');
    return;
  }

  // 3) احصل على التوكن
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration
    });
    console.log('✅ FCM token:', token);
    if (token && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ token sent to server');
    }
  } catch (e) {
    console.warn('⚠️ could not get/send token:', e);
  }

  // 4) استمع للرسائل عند فتح الصفحة
  onMessage(messaging, payload => {
    const { title, body } = payload.notification || {};
    const now = new Date().toLocaleString();
    if (title && body && Notification.permission === 'granted') {
      new Notification(title, { body });
      window.addNotification({ title, body, time: now });
    }
  });
}
