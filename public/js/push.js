// public/js/push.js

// 1) نقطة النهاية للـ API
const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';

// 2) إعدادات Firebase (مطابقة firebase-messaging-sw.js)
const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",   // ← تأكد من وجود هذا السطر
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};
const VAPID_PUBLIC_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// 3) دالة تهيئة FCM + SW
async function initPush() {
  try {
    // 3.1) تسجيل Service Worker
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ FCM SW registered:', swRegistration.scope);

    // 3.2) init Firebase
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const messaging = firebase.messaging();

    // 3.3) طلب إذن الإشعارات
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('❌ الإذن مرفوض');
      return;
    }

    // 3.4) جلب التوكن
    const currentToken = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swRegistration
    });
    if (!currentToken) {
      console.warn('❌ لم يتم الحصول على التوكن');
      return;
    }
    console.log('✅ FCM token:', currentToken);

    // 3.5) إرسال التوكن للخادم
    if (window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type':'application/json' },
        body: JSON.stringify({ user: window.currentUser, token: currentToken })
      });
      console.log('✅ token registered on server');
    } else {
      console.warn('❌ currentUser غير معرف');
    }

    // 3.6) استقبال الرسائل في الـ foreground
    messaging.onMessage(payload => {
      const { title, body } = payload.notification || {};
      if (!title) return;
      // عرض إشعار نظامي
      new Notification(title, { body });
      // حفظ في localStorage
      const now = new Date().toLocaleString();
      const list = JSON.parse(localStorage.getItem('notifications') || '[]');
      list.unshift({ title, body, time: now });
      localStorage.setItem('notifications', JSON.stringify(list));
      // تحديث واجهة الإشعارات
      window.initNotifications?.();
    });

  } catch (err) {
    console.error('❌ initPush error:', err);
  }
}
<<<<<<< HEAD
window.initPush = initPush;
=======
window.initPush = initPush;
>>>>>>> 14278bbae2167215013fc0e26d7b845248f2a020
