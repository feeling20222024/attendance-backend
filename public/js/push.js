// public/js/push.js

// —————————————————————————————————————————
// 1) استيراد Modular API من Firebase
// —————————————————————————————————————————
import { getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported
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
const messaging = getMessaging();

// —————————————————————————————————————————
// 4) تهيئة إشعارات الويب (Web Push)
// —————————————————————————————————————————
export async function initPushWeb() {
  // 4.0) تحقق من دعم Web Push
  if (!(await isSupported())) {
    console.warn('⚠️ Web Push غير مدعوم في هذا المتصفح، سيتم اعتماد الإشعارات المحلية فقط.');
    return;
  }

  // 4.1) تسجيل Service Worker
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ FCM SW registered:', reg.scope);
  } catch (err) {
    console.error('❌ SW registration failed:', err);
    return;
  }

  // 4.2) طلب إذن الإشعارات
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('🔕 Notification permission not granted.');
      return;
    }
  } catch (err) {
    console.warn('⚠️ خطأ عند طلب إذن الإشعارات:', err);
    return;
  }

  // 4.3) الحصول على Token وإرساله للسيرفر
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
      console.log('✅ أُرسل Token للسيرفر');
    }
  } catch (err) {
    console.warn('⚠️ تعذّر الحصول على FCM token أو إرساله— نتابع بدون Web Push:', err);
  }

  // 4.4) الاستماع للرسائل الواردة أثناء تواجد الصفحة في الواجهة
  onMessage(messaging, payload => {
    const { title, body } = payload.notification || {};
    console.log('📩 رسالة واردة (Web):', title, body);
    if (Notification.permission === 'granted' && title && body) {
      new Notification(title, { body });
      window.addNotification({ title, body, time: new Date().toLocaleString() });
    }
  });
}

// —————————————————————————————————————————
// 5) تهيئة إشعارات الجوال (Capacitor Native)
// —————————————————————————————————————————
export async function initPushNative() {
  let PushNotifications;
  try {
    // استيراد ديناميكي لمكوّن PushNotifications من Capacitor
    ({ PushNotifications } = await import('@capacitor/push-notifications'));
  } catch {
    // إذا كان الكود يعمل في المتصفح فقط
    return;
  }

  // 5.1) إنشاء قناة الإشعارات (Android 8+)
  await PushNotifications.createChannel({
    id: 'default',
    name: 'الإشعارات الرئيسية',
    description: 'القناة الأساسية لإشعارات التطبيق',
    importance: 5,
    vibrationPattern: [100, 200, 100],
    sound: 'default'
  }).catch(() => {});

  // 5.2) طلب الإذن
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') {
    console.warn('🔕 Push permission not granted.');
    return;
  }

  // 5.3) تسجيل الجهاز لدى FCM
  await PushNotifications.register();

  // 5.4) مستمع تسجيل التوكن
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

  // 5.5) مستمع استقبال الإشعارات في الواجهة الأمامية
  PushNotifications.addListener('pushNotificationReceived', notif => {
    console.log('📩 Notification received (Native):', notif);
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
