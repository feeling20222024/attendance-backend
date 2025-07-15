// public/push.js

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

// 3. دالة لجلب الإشعارات من الخادم Firestore
window.loadNotificationsFromServer = async function() {
  const jwt = localStorage.getItem('jwtToken');
  if (!jwt) return;

  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { 'Authorization': `Bearer ${jwt}` }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const json = await res.json();

    if (Array.isArray(json.data)) {
      localStorage.setItem('notificationsLog', JSON.stringify(json.data.map(n => ({
        title: n.title,
        body:  n.body,
        time:  n.time
      }))));
      if (typeof window.renderNotifications === 'function') window.renderNotifications();
      if (typeof window.updateBellCount === 'function') window.updateBellCount();
      console.log('✅ Loaded notifications from Firestore');
    }
  } catch (e) {
    console.warn('❌ Failed to load notifications from Firestore:', e);
  }
};

// 4. تهيئة إشعارات الويب وطلب رمز FCM
window.initNotifications = async function () {
  // 1) سجِّل SW من الجذر
  let swRegistration;
  try {
    swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW registered:', swRegistration.scope);
  } catch (err) {
    console.error('❌ فشل تسجيل SW:', err);
    return;
  }

  // 2) انتظر حتى يصبح SW “active”
  try {
    await navigator.serviceWorker.ready;
    console.log('✅ SW is active');
  } catch (err) {
    console.error('❌ خطأ أثناء انتظار ready لـ SW:', err);
    return;
  }

  // 3) هيِّئ Firebase وأحصل على Messaging instance
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const messaging = firebase.messaging();

  // 4) اطلب إذن الإشعارات
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    console.warn('🔕 إذن الإشعارات غير ممنوح');
    return;
  }

  // 5) اطلب رمز FCM باستخدام SW الفعّال
  try {
    const token = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swRegistration
    });
    console.log('✅ FCM Token:', token);

    // إذا كان المستخدم مسجلاً دخولاً حالياً
    const jwt = localStorage.getItem('jwtToken');
    if (jwt) {
      // أرسل التوكن للخادم فوراً
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ Token sent to server');

      // جلب الإشعارات من Firestore بعد تسجيل الدخول
      await window.loadNotificationsFromServer();
    } else {
      // لم يُسجّل دخول بعد: خزّن التوكن بانتظار تسجيل الدخول
      window._pendingFCMToken = token;
      console.log('📌 Token pending until login');
    }
  } catch (err) {
    console.error('❌ أثناء طلب FCM Token:', err);
  }

  // 6) استمع لرسائل أثناء فتح التطبيق (foreground)
  messaging.onMessage(async payload => {
    const { title, body } = payload.notification || {};
    if (title && body) {
      new Notification(title, { body });
      const time = new Date().toLocaleString();

      // تخزين محلي
      window.addNotification({ title, body, time });

      // إرسال نسخة للخادم لتخزين Firestore
      const jwt = localStorage.getItem('jwtToken');
      if (jwt) {
        try {
          await fetch(`${API_BASE}/notifications`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwt}`
            },
            body: JSON.stringify({ title, body, time })
          });
          console.log('✅ Notification stored in Firestore');
        } catch (e) {
          console.warn('❌ Failed to store notification in Firestore:', e);
        }
      }
    }
  });
};

// 5. تعريف initPush لاستدعاء initNotifications
window.initPush = async function () {
  console.log('🚀 initPush called');
  if (typeof window.initNotifications === 'function') {
    await window.initNotifications();
  }

  // تحميل الإشعارات من الخادم إذا مسجل دخول
  if (localStorage.getItem('jwtToken')) {
    await window.loadNotificationsFromServer();
  }
};
