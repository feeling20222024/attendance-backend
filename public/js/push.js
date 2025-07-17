// 1. إعدادات
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

// 2. دالة addNotification - ✅ بعد التصحيح
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


// 3. تهيئة إشعارات الويب
window.initNotifications = async function () {
  try {
    // 1) سجّل الـ SW وانتظر حتى يكون جاهزاً
    console.log('🚀 Registering Firebase SW…');
    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    // هذه الخطوة تضمن أن الـ SW أصبح “active”
    await navigator.serviceWorker.ready;
    console.log('✅ SW for Firebase active:', registration.scope);

    // 2) هيّئ Firebase إذا لم يكن مهيّئاً
    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    const messaging = firebase.messaging();

    // 3) اطلب إذن الإشعارات
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('🔕 إذن الإشعارات لم يُمنح');
      return;
    }

    // 4) احصل على التوكن باستخدام registration الجاهز
    console.log('🚀 Getting FCM token…');
    const token = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });
    console.log('✅ FCM token:', token);

    // 5) أرسل التوكن إلى الخادم إذا كان المستخدم معرّف
    if (token && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ Token registered on server');
    }

    // 6) استمع للرسائل الواردة عندما تكون الصفحة في الـ foreground
    messaging.onMessage(payload => {
      const { title, body } = payload.notification || {};
      if (title && body) {
        // عرض تنبيه نظامي
        new Notification(title, { body });
        // إضافة للسجل والعداد
        window.addNotification({
          title, body,
          time: new Date().toLocaleString()
        });
      }
    });

  } catch (err) {
    console.error('❌ initNotifications error:', err);
  }
};


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

// 4. تعريف initPush لتجنب الخطأ
window.initPush = async function () {
  console.log('initPush called');
  if (typeof window.initNotifications === 'function') {
    await window.initNotifications();
  }
};
