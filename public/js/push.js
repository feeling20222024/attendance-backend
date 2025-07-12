// —————————————————————————————————————————
// public/js/push.js
// —————————————————————————————————————————

// 1) استيراد Modular API من Firebase
import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getMessaging,
  getToken,
  onMessage
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js';

// 2) إعدادات التطبيق والسيرفر
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

// 3) تهيئة Firebase (مرة واحدة فقط)
if (!getApps().length) {
  initializeApp(firebaseConfig);
}
const messaging = getMessaging();

// 4) دالة موحدة لتسجيل Service Worker وطلب الإذن وتسجيل التوكن
export async function initPushWeb() {
  // 4.1 تسجيل SW
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ FCM SW registered:', reg.scope);
  } catch (err) {
    console.error('❌ SW registration failed:', err);
    return;
  }

  // 4.2 طلب إذن الإشعارات
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    console.warn('🔕 Notification permission not granted.');
    return;
  }

  // 4.3 احصل على التوكن
// 5.2 طلب الإذن وإحضار التوكن (محاط بــ try/catch أوسع)
let token = null;
try {
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    console.warn('🔕 إذن الإشعارات غير ممنوح');
    return;
  }

  const registration = await navigator.serviceWorker.getRegistration();
  // إذا تعرّضنا للخطأ "non ISO‑8859‑1 code point" أو أي خطأ آخر—
  // سنقوم بإهمال الـ token ونبقي على عمل الإشعارات محليًا فقط:
  token = await getToken(messaging, {
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
    console.log('✅ أُرسل Token للسيرفر');
  }
} catch (e) {
  console.warn('⚠️ تعذّر الحصول على FCM token أو إرساله— نتابع بدون ويب بوّش:', e);
  // هنا نتوقف عند هذا الحد، ونمضي قدماً بالـ local notifications فقط
}


  // 4.4 استمع للرسائل الواردة
  onMessage(messaging, payload => {
    const { title, body } = payload.notification || {};
    console.log('📩 Message received (web):', title, body);
    if (title && body && Notification.permission === 'granted') {
      new Notification(title, { body });
      window.addNotification({ title, body, time: new Date().toLocaleString() });
    }
  });
}

// 5) تهيئة إشعارات الجوال (Capacitor Native)
export async function initPushNative() {
  let PushNotifications;
  try {
    // استيراد ديناميكي حتى لا يخطئ المتصفح
    ({ PushNotifications } = await import('@capacitor/push-notifications'));
  } catch {
    return;
  }

  // 5.1 إنشاء القناة
  await PushNotifications.createChannel({
    id: 'default',
    name: 'الإشعارات الرئيسية',
    description: 'القناة الأساسية',
    importance: 5,
    vibrationPattern: [100, 200, 100],
    sound: 'default'
  }).catch(() => {});

  // 5.2 طلب الإذن
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') {
    console.warn('🔕 Push permission not granted.');
    return;
  }

  // 5.3 تسجيل الجهاز
  await PushNotifications.register();

  // 5.4 مستمع التسجيل
  PushNotifications.addListener('registration', ({ value }) => {
    console.log('✅ Native Token:', value);
    if (window.currentUser) {
      fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token: value })
      }).catch(console.error);
    }
  });

  // 5.5 مستمع الرسائل الواردة
  PushNotifications.addListener('pushNotificationReceived', notif => {
    console.log('📩 Notification received (native):', notif);
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

// 6) دالة موحدة لاستدعاء الاثنين
export async function initPush() {
  console.log('⚙️ initPush');
  await initPushWeb();
  await initPushNative();
}
