// push.js

// 1. ثوابت الإعداد
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

// 2. دالة إضافة إشعار إلى السجل المحلي
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

// 3. دالة تهيئة إشعارات الويب
window.initNotifications = async function () {
  try {
    // 3.1 تسجيل Service Worker والانتظار حتى يصبح active
    console.log('🚀 Registering Firebase SW…');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    await navigator.serviceWorker.ready;
    console.log('✅ SW for Firebase active:', registration.scope);

    // 3.2 تهيئة Firebase (مرة واحدة)
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const messaging = firebase.messaging();

    // 3.3 طلب إذن الإشعارات
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('🔕 إذن الإشعارات لم يُمنح');
      return;
    }

    // 3.4 الحصول على FCM token
    console.log('🚀 Getting FCM token…');
    const token = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });
    console.log('✅ FCM token:', token);

    // 3.5 إرسال التوكن إلى الخادم
    if (token && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ Token registered on server');
    }

    // 3.6 استقبال الرسائل أثناء وجود الصفحة مفتوحة
    messaging.onMessage(payload => {
      const { title, body } = payload.notification || {};
      if (title && body) {
        new Notification(title, { body });
        window.addNotification({
          title,
          body,
          time: new Date().toLocaleString()
        });
      }
    });

  } catch (err) {
    console.error('❌ initNotifications error:', err);
  }
};

// 4. تعريف initPush كغلاف لـ initNotifications
window.initPush = async function () {
  console.log('🚀 initPush called');
  if (typeof window.initNotifications === 'function') {
    await window.initNotifications();
  }
};
