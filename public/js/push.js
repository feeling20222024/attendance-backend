// —————————————————————————————————————————
// 1) نقطة النهاية للـ API
// —————————————————————————————————————————
const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';

// —————————————————————————————————————————
// 2) إعدادات Firebase (مطابقة firebase-messaging-sw.js)
// —————————————————————————————————————————
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
// 3) دالة تُخزّن الإشعار في localStorage وتُحدّث الواجهة
// —————————————————————————————————————————
window.addNotification = ({ title, body, time }) => {
  const saved = JSON.parse(localStorage.getItem('notifications') || '[]');
  saved.unshift({ title, body, time });
  localStorage.setItem('notifications', JSON.stringify(saved));
  // إذا كانت لوحة الإشعارات مُهيّأة، حدّثها
  if (typeof window.initNotifications === 'function') {
    window.initNotifications();
  }
};

// —————————————————————————————————————————
// 4) دالة تهيئة إشعارات الويب عبر FCM + SW
// —————————————————————————————————————————
async function initPush() {
  try {
    // 4.1) تسجيل Service Worker الخاصّ بـ FCM
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ Service Worker for Firebase registered:', swRegistration.scope);

    // 4.2) تهيئة Firebase وMessaging
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const messaging = firebase.messaging();

    // 4.3) طلب إذن الإشعارات
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('❌ المستخدم لم يمنح إذن الإشعارات');
      return;
    }

    // 4.4) جلب FCM token
    const currentToken = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swRegistration
    });
    if (!currentToken) {
      console.warn('❌ لم يتمكّن من الحصول على FCM token');
      return;
    }
    console.log('✅ FCM Registration Token obtained:', currentToken);

    // 4.5) إرسال التوكن للخادم (إذا كان currentUser معرف)
    if (window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token: currentToken })
      });
      console.log('✅ تم تسجيل توكن FCM بنجاح على الخادم');
    } else {
      console.warn('❌ currentUser غير معرف، لم يُرسل التوكن للخادم');
    }

    // 4.6) استقبال الرسائل في الواجهة (foreground)
   messaging.onMessage(payload => {
  const { title, body } = payload.notification || {};
  if (!title) return;

  // عرض الإشعار للمستخدم
  new Notification(title, { body });

  // خزن الإشعار فوريًا في localStorage
  const now = new Date().toLocaleString();
  window.addNotification({ title, body, time: now });
});
  } catch (err) {
    console.error('❌ خطأ أثناء تهيئة الإشعارات (initPush):', err);
  }
}
// إتاحة الدالة عالميًا
window.initPush = initPush;
