// —————————————————————————————————————————
// استيراد مكتبات Firebase (Web modular API)
// —————————————————————————————————————————
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getMessaging,
  getToken,
  onMessage
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js';

// —————————————————————————————————————————
// ثوابت إعداد Firebase
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
// تهيئة إشعارات الويب (Firebase Cloud Messaging)
// serviceWorkerRegistration يُمرر لتجنب الخطأ: no active Service Worker
// —————————————————————————————————————————
export async function initPush(serviceWorkerRegistration) {
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  // 1) احصل على التوكن وأرسله للسيرفر
  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration
    });
    console.log('✅ FCM token:', token);

    if (localStorage.getItem('fcmTokenSent') !== token) {
      await fetch('https://dwam-app-by-omar.onrender.com/api/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      localStorage.setItem('fcmTokenSent', token);
    }
  } catch (err) {
    console.error('❌ getToken/register-token failed:', err);
  }

  // 2) جلب سجل الإشعارات من الخادم
  try {
    const res = await fetch('https://dwam-app-by-omar.onrender.com/api/notifications', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
      }
    });
    if (res.ok) {
      const { notifications } = await res.json();
      localStorage.setItem('notificationsLog', JSON.stringify(notifications));
      if (typeof window.renderNotifications === 'function') window.renderNotifications();
      if (typeof window.updateBellCount === 'function') window.updateBellCount();
    }
  } catch (e) {
    console.warn('⚠️ failed to fetch notifications log:', e);
  }

  // 3) استقبال الرسائل أثناء تواجد التطبيق في الواجهة
  onMessage(messaging, payload => {
    const { title = '', body = '' } = payload.notification || {};
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    if (typeof window.addNotification === 'function') {
      window.addNotification({ title, body, time: new Date().toISOString() });
    }
  });
}

// —————————————————————————————————————————
// تهيئة إشعارات Native (Capacitor) - إن وجد
// —————————————————————————————————————————
export async function initPushNative() {
  let PushNotifications;
  try {
    ({ PushNotifications } = await import('https://unpkg.com/@capacitor/push-notifications/dist/esm/index.js'));
  } catch {
    return console.warn('⚠️ Capacitor Push import failed');
  }

  try {
    await PushNotifications.createChannel({
      id: 'default',
      name: 'الإشعارات الرئيسية',
      importance: 5,
      vibrationPattern: [100, 200, 100],
      sound: 'default'
    });
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;
    await PushNotifications.register();
  } catch {
    return console.warn('⚠️ Native init failed');
  }

  PushNotifications.addListener('registration', ({ value }) => {
    fetch('https://dwam-app-by-omar.onrender.com/api/register-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: window.currentUser, token: value })
    }).catch(console.error);
  });

  PushNotifications.addListener('pushNotificationReceived', notif => {
    const { title = '', body = '' } = notif;
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    if (typeof window.addNotification === 'function') {
      window.addNotification({ title, body, time: new Date().toISOString() });
    }
  });
}

// —————————————————————————————————————————
// ربط الدوال على window
// —————————————————————————————————————————
window.initPush       = initPush;
window.initPushNative = initPushNative;
