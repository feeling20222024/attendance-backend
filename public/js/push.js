// public/js/push.js

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

// 2. دالة إضافة إشعار
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

  //  إضافته إلى الخادم
  if (window.currentUser) {
    fetch(`${API_BASE}/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
      },
      body: JSON.stringify({ title, body, time })
    }).catch(console.warn);
  }
};

// 3. دالة تهيئة إشعارات الويب
window.initNotifications = async function () {
  // سجل الـ SW
  try {
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW for Firebase registered:', swReg.scope);
    await navigator.serviceWorker.ready;
  } catch (err) {
    console.error('❌ فشل تسجيل SW:', err);
    return;
  }

  // هيّئ Firebase
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const messaging = firebase.messaging();

  // طلب إذن
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.warn('🔕 إذن الإشعارات غير ممنوح');
      return;
    }
  } catch (err) {
    console.error('❌ خطأ عند طلب الإذن:', err);
    return;
  }

  // احصل على التوكن
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const token = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });
    console.log('✅ FCM token:', token);

    if (token && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ Token registered on server');
    }
  } catch (err) {
    console.error('❌ خطأ في الحصول على التوكن أو تسجيله:', err);
  }

  // استمع للرسائل الواردة
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
};

// 4. دالة initPush لتحميل سجل الإشعارات الموحد
window.initPush = async function () {
  console.log('🚀 initPush called');
  if (typeof window.initNotifications === 'function') {
    // 1) تهيئة SW وFirebase
    await window.initNotifications();

    // 2) جلب سجل الإشعارات من الخادم
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      });
      if (res.ok) {
        const { notifications } = await res.json();
        localStorage.setItem('notificationsLog', JSON.stringify(notifications));
        window.renderNotifications();
        window.updateBellCount();
      }
    } catch (err) {
      console.warn('⚠️ failed to fetch notifications log:', err);
    }
  }
};
