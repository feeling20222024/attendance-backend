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
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW for Firebase registered:', swReg.scope);
  } catch (err) {
    console.error('❌ فشل تسجيل SW:', err);
  }

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

  // داخل addNotification بعد localStorage.setItem(...)
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
