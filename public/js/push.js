// push.js

// —————————————————————————————————————————
// 1) إعداد المتغيرات العامة
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
// 2) إضافة إشعار إلى localStorage وتحديث الواجهة
// —————————————————————————————————————————
window.addNotification = ({ title, body, time }) => {
  const STORAGE_KEY = 'notificationsLog';
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  saved.unshift({ title, body, time });
  if (saved.length > 50) saved.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

  if (typeof window.renderNotifications === 'function') window.renderNotifications();
  if (typeof window.updateBellCount === 'function') window.updateBellCount();

  console.log('📩 إشعار مضاف:', { title, body, time });
};

// —————————————————————————————————————————
// 3) تهيئة Firebase وإشعارات الويب (Service Worker + FCM)
// —————————————————————————————————————————
window.initNotifications = async function () {
  // تسجيل Service Worker
  let swRegistration;
  try {
    swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW registered:', swRegistration.scope);
  } catch (err) {
    console.error('❌ فشل تسجيل SW:', err);
    return;
  }

  // انتظار تفعيل SW
  try {
    await navigator.serviceWorker.ready;
    console.log('✅ SW is active');
  } catch (err) {
    console.error('❌ خطأ أثناء انتظار ready لـ SW:', err);
    return;
  }

  // تهيئة Firebase
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const messaging = firebase.messaging();

  // طلب إذن الإشعارات
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    console.warn('🔕 إذن الإشعارات غير ممنوح');
    return;
  }

  // الحصول على FCM Token
  try {
    const token = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swRegistration
    });
    console.log('✅ FCM Token:', token);

    // إرسال التوكن للخادم إذا كان المستخدم مسجلاً دخولاً
    const jwt = localStorage.getItem('jwtToken');
    if (jwt && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwt}`
        },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ Token sent to server');
    } else {
      // تخزين التوكن بانتظار تسجيل الدخول
      window._pendingFCMToken = token;
      console.log('📌 Token pending until login');
    }
  } catch (err) {
    console.error('❌ أثناء طلب FCM Token:', err);
  }

  // استقبال الرسائل أثناء فتح التطبيق (foreground)
  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    if (title && body) {
      new Notification(title, { body });
      window.addNotification({ title, body, time: new Date().toLocaleString() });
    }
  });

  // جلب الإشعارات من الخادم لتحديث السجل عند التهيئة
  if (typeof window.loadNotificationsFromServer === 'function') {
    await window.loadNotificationsFromServer();
  }
};

// —————————————————————————————————————————
// 4) دالة لجلب سجل الإشعارات من الخادم وتخزينها
// —————————————————————————————————————————
window.loadNotificationsFromServer = async function () {
  const jwt = localStorage.getItem('jwtToken');
  if (!jwt) {
    console.warn('⚠️ لا يوجد توكن JWT مخزن، الرجاء تسجيل الدخول.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      }
    });

    console.log('🔄 استجابة الخادم للإشعارات:', res.status, res.statusText);

    const text = await res.text();

    try {
      const json = JSON.parse(text);

      if (!json.data) {
        console.warn('⚠️ الرد من الخادم لا يحتوي على بيانات "data".', json);
      }

      localStorage.setItem('notificationsLog', JSON.stringify(json.data || []));

      if (typeof window.renderNotifications === 'function') window.renderNotifications();
      if (typeof window.updateBellCount === 'function') window.updateBellCount();

      console.log('✅ تم جلب الإشعارات وتحديثها من الخادم بنجاح.');
    } catch (jsonError) {
      console.error('❌ الخطأ: الرد من الخادم ليس JSON صالح:', text);
      throw jsonError;
    }

  } catch (fetchError) {
    console.error('❌ فشل في جلب الإشعارات من الخادم:', fetchError);
  }
};

// —————————————————————————————————————————
// 5) initPush هي دالة مساعدة لاستدعاء initNotifications()
// —————————————————————————————————————————
window.initPush = async function () {
  console.log('🚀 initPush called');
  if (typeof window.initNotifications === 'function') {
    await window.initNotifications();
  }
};
