// ———————————————————————————————
// إعدادات
const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';

const firebaseConfig = {
  apiKey: "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain: "device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket: "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId: "1:235398312189:web:8febe5e63f7b134b808e94"
};

const VAPID_PUBLIC_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// ———————————————————————————————
// دالة لتخزين الإشعارات موحدًا
window.addNotification = ({ title, body, time }) => {
  const saved = JSON.parse(localStorage.getItem('notificationsLog') || '[]');
  saved.unshift({ title, body, time });
  if (saved.length > 50) saved.pop();
  localStorage.setItem('notificationsLog', JSON.stringify(saved));

  if (typeof window.renderNotifications === 'function') {
    window.renderNotifications();
  }
  if (typeof window.updateBellCount === 'function') {
    window.updateBellCount();
  }

  console.log('📩 إشعار مضاف:', { title, body, time });
};

// ———————————————————————————————
// إشعارات الويب باستخدام Firebase compat
window.initNotifications = async function () {
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW for Firebase registered:', reg.scope);
  } catch (err) {
    console.error('❌ فشل تسجيل SW:', err);
    return;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const messaging = firebase.messaging();

  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.warn('🔕 إذن الإشعارات غير ممنوح');
      return;
    }

    const registration = await navigator.serviceWorker.getRegistration();
    const token = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });

    if (token && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ تم إرسال FCM Token إلى الخادم');
    }
  } catch (err) {
    console.error('❌ أثناء طلب FCM Token:', err);
  }

  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    if (title && body) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      }
      window.addNotification({ title, body, time: new Date().toLocaleString() });
    }
  });
};

// ———————————————————————————————
// إشعارات الجوال باستخدام Capacitor (اختياري)
window.initNativePush = async function () {
  if (!window.Capacitor?.isNativePlatform()) return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    await PushNotifications.requestPermissions();
    await PushNotifications.register();

    PushNotifications.addListener('registration', async ({ value }) => {
      if (value && window.currentUser) {
        await fetch(`${API_BASE}/register-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user: window.currentUser, token: value })
        });
        console.log('✅ تم تسجيل Native token:', value);
      }
    });

    PushNotifications.addListener('pushNotificationReceived', notif => {
      const { title, body } = notif;
      if (title && body) {
        if (Notification.permission === 'granted') {
          new Notification(title, { body });
        }
        window.addNotification({ title, body, time: new Date().toLocaleString() });
      }
    });

  } catch (err) {
    console.warn('❌ فشل تهيئة إشعارات الجوال:', err);
  }
};

// ———————————————————————————————
// دالة موحدة للتهيئة (ويب + جوال)
window.initPush = async function () {
  console.log('⚙️ initPush started');
  try {
    if (typeof window.initNotifications === 'function') {
      await window.initNotifications();
    }
    if (typeof window.initNativePush === 'function') {
      await window.initNativePush();
    }
  } catch (err) {
    console.warn('⚠️ initPush error:', err);
  }
};
