// public/js/push.js

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

// إضافة آمنة: يخزن محليًا ثم على الخادم
async function safeAddNotification({ title, body, time }) {
  try {
    // 1) خزّن محلياً
    const saved = JSON.parse(localStorage.getItem('notificationsLog') || '[]');
    saved.unshift({ title, body, time });
    if (saved.length > 50) saved.pop();
    localStorage.setItem('notificationsLog', JSON.stringify(saved));

    // 2) خزّن على الخادم
    if (window.currentUser) {
      await fetch(`${API_BASE}/save-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, title, body, time })
      });
    }

    // 3) حدّث العرض
    if (typeof window.renderNotifications === 'function') window.renderNotifications();
    if (typeof window.updateBellCount     === 'function') window.updateBellCount();

    console.log('📩 إشعار محفوظ:', { title, body, time });
  } catch (e) {
    console.warn('⚠️ خطأ في تخزين الإشعار:', e);
  }
}

// في كل مكان كنت تستدعي window.addNotification
// استبدلها باستدعاء safeAddNotification:
window.addNotification = safeAddNotification;

// تهيئة Web Push
window.initNotifications = async function() {
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW for Firebase registered:', reg.scope);
  } catch (err) {
    console.error('❌ SW registration failed:', err);
    return;
  }

  // compat
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
    const swReg = await navigator.serviceWorker.getRegistration();
    const token = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swReg
    });
    console.log('✅ FCM Token:', token);
    if (token && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
    }
  } catch (e) {
    console.warn('⚠️ Unable to get/send FCM token:', e);
  }

  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    const now = new Date().toLocaleString();
    if (title && body && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    safeAddNotification({ title, body, time: now });
  });
};

// دالة موحدة لاستدعاء التهيئات
window.initPush = async function() {
  console.log('⚙️ initPush');
  if (typeof window.initNotifications === 'function') {
    await window.initNotifications();
  }
  // إذا كان لديك push native عبر Capacitor، أضفه هنا
};
