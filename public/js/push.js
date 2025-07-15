// 1. إعدادات أساسية
const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';

const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};

// مفتاح VAPID العام الخاص بمشروعك من Firebase Console → Cloud Messaging → Web Push certificates
const VAPID_PUBLIC_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// 2. دالة لإضافة الإشعار محلياً
window.addNotification = ({ title, body, time }) => {
  const STORAGE_KEY = 'notificationsLog';
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  saved.unshift({ title, body, time });
  if (saved.length > 50) saved.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

  if (typeof window.renderNotifications === 'function') window.renderNotifications();
  if (typeof window.updateBellCount === 'function')     window.updateBellCount();

  console.log('📩 إشعار مضاف:', { title, body, time });
};

// 3. تهيئة إشعارات الويب وطلب رمز FCM
window.initNotifications = async function () {
  // 3.1 تسجيل Service Worker
  let swReg;
  try {
    swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW for Firebase registered:', swReg.scope);
  } catch (err) {
    console.error('❌ فشل تسجيل SW:', err);
    return;
  }

  // 3.2 تهيئة Firebase إذا لم تكن مهيأة
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const messaging = firebase.messaging();

  // 3.3 طلب إذن الإشعارات
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    console.warn('🔕 إذن الإشعارات غير ممنوح');
    return;
  }

  // 3.4 طلب رمز FCM
  try {
    const token = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swReg
    });
    console.log('✅ FCM Token:', token);

    // إرسال الرمز إلى الخادم للتسجيل
    await fetch(`${API_BASE}/register-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: window.currentUser, token })
    });
    console.log('✅ Token sent to server');
  } catch (err) {
    console.error('❌ أثناء طلب FCM Token:', err);
  }

  // 3.5 استقبال الإشعارات عند فتح التطبيق
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

// 4. تعريف initPush لاستدعاء initNotifications
window.initPush = async function () {
  console.log('🚀 initPush called');
  if (typeof window.initNotifications === 'function') {
    await window.initNotifications();
  }
};
