// public/js/push.js

// —————————————————————————————————————————
// 1) استيراد Modular API من Firebase
// —————————————————————————————————————————
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getMessaging,
  getToken,
  onMessage
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js';

// ملاحظة: استيراد Capacitor PushNotifications في موديول منفصل (Native) فقط، لا تضعه هنا للويب.

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
// 3) تهيئة Firebase + Messaging
// —————————————————————————————————————————
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// —————————————————————————————————————————
// 4) دالة لإضافة إشعار للسجل المحلي (يتولى notifications.js العرض)
// —————————————————————————————————————————
window.addNotification = ({ title, body, time }) => {
  const KEY = 'notificationsLog';
  const saved = JSON.parse(localStorage.getItem(KEY) || '[]');
  saved.unshift({ title, body, time });
  if (saved.length > 50) saved.pop();
  localStorage.setItem(KEY, JSON.stringify(saved));
  if (typeof window.renderNotifications === 'function') window.renderNotifications();
  if (typeof window.updateBellCount     === 'function') window.updateBellCount();
  console.log('📩 إشعار مضاف محلياً:', { title, body, time });
};

// —————————————————————————————————————————
// 5) تهيئة إشعارات الويب (FCM)
// —————————————————————————————————————————
export async function initPushWeb() {
  // 5.1 تسجيل Service Worker
  try {
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW for FCM registered:', swReg.scope);
  } catch (e) {
    console.error('❌ فشل تسجيل SW:', e);
    return;
  }

  // 5.2 طلب الإذن وإحضار التوكن
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.warn('🔕 إذن الإشعارات غير ممنوح');
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });

    console.log('✅ FCM Token:', token);
    // 5.3 إرسال التوكن إلى السيرفر
    if (token && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ أُرسل Token للسيرفر');
    }
  } catch (e) {
    console.error('❌ خطأ أثناء طلب FCM Token:', e);
  }

  // 5.4 الاستماع للرسائل الواردة طالما الصفحة مفتوحة
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
// 6) تهيئة إشعارات الجوال (Capacitor Native)
// —————————————————————————————————————————
// نحمّل PushNotifications فقط عندما يكون الكود مجمّعاً عبر Capacitor:
export async function initPushNative() {
  let plugin;
  try {
    // dynamically import so browser لا يحدث خطأ
    const mod = await import('@capacitor/push-notifications');
    plugin = mod.PushNotifications;
  } catch {
    return; // إذا كانت البيئة ويب فقط
  }

  // 6.1 أنشئ القناة
  try {
    await plugin.createChannel({
      id: 'default',
      name: 'الإشعارات الرئيسية',
      description: 'القناة الأساسية',
      importance: 5,
      vibrationPattern: [100,200,100],
      sound: 'default'
    });
    console.log('🔔 قناة default أنشئت');
  } catch {}

  // 6.2 طلب الإذن
  const perm = await plugin.requestPermissions();
  if (perm.receive !== 'granted') {
    console.warn('🔕 إذن Push غير ممنوح');
    return;
  }

  // 6.3 تسجيل الجهاز
  await plugin.register();

  // 6.4 استمع لحدث التسجيل
  plugin.addListener('registration', ({ value }) => {
    console.log('✅ Native Token:', value);
    if (window.currentUser) {
      fetch(`${API_BASE}/register-token`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ user: window.currentUser, token: value })
      }).catch(console.error);
    }
  });

  // 6.5 استمع للإشعارات الواردة في الـ foreground
  plugin.addListener('pushNotificationReceived', notif => {
    console.log('📩 وارد (Native):', notif);
    if (Notification.permission === 'granted') {
      new Notification(notif.title, {
        body: notif.body,
        tag: 'default',
        vibrate: [100,200,100]
      });
    }
    window.addNotification({
      title: notif.title,
      body: notif.body,
      time: new Date().toLocaleString()
    });
  });
}

// —————————————————————————————————————————
// 7) دالة موحدة لاستدعاء الاثنين بناءً على المنصة
// —————————————————————————————————————————
export async function initPush() {
  console.log('⚙️ initPush');
  await initPushWeb();
  await initPushNative();
}
