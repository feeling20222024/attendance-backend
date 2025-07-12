// public/js/push.js

// —————————————————————————————————————————
// 1) استيراد Modular API من Firebase
// —————————————————————————————————————————
import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getMessaging,
  getToken,
  onMessage
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js';

// —————————————————————————————————————————
// 2) إعدادات التطبيق والسيرفر
// —————————————————————————————————————————
const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';
const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};
const VAPID_PUBLIC_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// —————————————————————————————————————————
// 3) تهيئة Firebase (مرة واحدة فقط)
// —————————————————————————————————————————
if (!getApps().length) {
  initializeApp(firebaseConfig);
}
let messaging;
try {
  messaging = getMessaging();
} catch {
  // المتصفح لا يدعم Messaging API
}

// —————————————————————————————————————————
// 4) دالة رئيسية لإعداد إشعارات الويب
// —————————————————————————————————————————
export async function initPushWeb() {
  if (!messaging || !('serviceWorker' in navigator)) {
    console.warn('⚠️ Web Push غير مدعوم، نتابع بالإشعارات المحلية فقط.');
    return;
  }

  // 4.1 تسجيل Service Worker
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW registered:', reg.scope);
  } catch (err) {
    console.warn('⚠️ SW registration failed:', err);
    return;
  }

  // 4.2 طلب إذن الإشعارات
  let perm;
  try {
    perm = await Notification.requestPermission();
  } catch {
    perm = 'denied';
  }
  if (perm !== 'granted') {
    console.warn('🔕 إذن الإشعارات غير ممنوح');
    return;
  }

  // 4.3 جلب وإرسال التوكن
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });
    console.log('✅ FCM Token:', token);
    if (token && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ Token أُرسل للسيرفر');
    }
  } catch (e) {
    console.warn('⚠️ Unable to get/send FCM token, falling back to local only:', e);
    // هنا نستمر بدون FCM
  }

  // 4.4 الاستماع للرسائل الواردة
  try {
    onMessage(messaging, payload => {
      const { title, body } = payload.notification || {};
      if (title && body && Notification.permission === 'granted') {
        new Notification(title, { body });
        window.addNotification({ title, body, time: new Date().toLocaleString() });
      }
    });
  } catch {
    // لا شيء
  }
}

// —————————————————————————————————————————
// 5) إشعارات الجوال عبر Capacitor (Native)
// —————————————————————————————————————————
export async function initPushNative() {
  let PushNotifications;
  try {
    ({ PushNotifications } = await import('@capacitor/push-notifications'));
  } catch {
    return;
  }

  // إنشاء القناة
  await PushNotifications.createChannel({
    id: 'default', name: 'الإشعارات الرئيسية',
    description: 'القناة الأساسية',
    importance: 5, vibrationPattern: [100,200,100],
    sound: 'default'
  }).catch(() => {});

  // طلب إذن
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') {
    console.warn('🔕 Push permission not granted.');
    return;
  }

  // تسجيل الجهاز
  await PushNotifications.register();

  // تسجيل التوكن
  PushNotifications.addListener('registration', ({ value }) => {
    console.log('✅ Native Token:', value);
    if (window.currentUser) {
      fetch(`${API_BASE}/register-token`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ user: window.currentUser, token: value })
      }).catch(console.error);
    }
  });

  // استقبال الإشعارات في الواجهة الأمامية
  PushNotifications.addListener('pushNotificationReceived', notif => {
    if (Notification.permission === 'granted') {
      new Notification(notif.title, { body: notif.body });
    }
    window.addNotification({
      title: notif.title,
      body: notif.body,
      time: new Date().toLocaleString()
    });
  });
}

// —————————————————————————————————————————
// 6) دالة موحدة لاستدعاء الاثنين
// —————————————————————————————————————————
export async function initPush() {
  console.log('⚙️ initPush');
  await initPushWeb();
  await initPushNative();
}
