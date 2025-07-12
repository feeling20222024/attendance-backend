// ——————————————————————————————
// إعداد Firebase و VAPID
// ——————————————————————————————
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

// ——————————————————————————————
// addNotification الآمنة
// ——————————————————————————————
function safeAddNotification({ title, body, time }) {
  try {
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
    console.log('📩 إشعار محفوظ:', { title, body, time });
  } catch (e) {
    console.warn('⚠️ خطأ في تخزين الإشعار:', e);
  }
}

// ——————————————————————————————
// initNotifications — للويب فقط
// ——————————————————————————————
window.initNotifications = async function () {
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW for Firebase registered:', reg.scope);
  } catch (err) {
    console.error('❌ فشل تسجيل SW:', err);
    return;
  }

  // تهيئة Firebase compat
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
      console.log('✅ أُرسل Token للسيرفر');
    }
  } catch (err) {
    console.error('❌ أثناء طلب FCM Token:', err);
  }

  // استقبال الإشعارات الواردة على الويب
  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    const now = new Date().toLocaleString();

    if (title && body && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    safeAddNotification({ title, body, time: now });
  });
};

// ——————————————————————————————
// initPushNative — للجوال (Capacitor)
// ——————————————————————————————
window.initPushNative = async function () {
  let PushNotifications;
  try {
    ({ PushNotifications } = await import('@capacitor/push-notifications'));
  } catch {
    return;
  }

  // إنشاء القناة
  await PushNotifications.createChannel({
    id: 'default',
    name: 'الإشعارات',
    description: 'الإشعارات العامة',
    importance: 5,
    vibrationPattern: [100, 200, 100],
    sound: 'default'
  }).catch(() => {});

  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') {
    console.warn('🔕 إذن إشعارات الجوال غير ممنوح');
    return;
  }

  await PushNotifications.register();

  PushNotifications.addListener('registration', async ({ value }) => {
    console.log('✅ Native Token:', value);
    if (window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token: value })
      }).catch(console.error);
    }
  });

  PushNotifications.addListener('pushNotificationReceived', notif => {
    const { title, body } = notif;
    const now = new Date().toLocaleString();

    if (title && body && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    safeAddNotification({ title, body, time: now });
  });
};

// ——————————————————————————————
// دالة موحدة
// ——————————————————————————————
window.initPush = async function () {
  console.log('⚙️ initPush()');
  if (typeof window.initNotifications === 'function') {
    await window.initNotifications();
  }
  if (typeof window.initPushNative === 'function') {
    await window.initPushNative();
  }
};
