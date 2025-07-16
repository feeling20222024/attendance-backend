// public/js/push.js

// ——————————————————————————————
// 1) إعدادات السيرفر وFirebase
// ——————————————————————————————
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

// ——————————————————————————————
// 2) دالة مساعدة لحفظ الإشعار في السيرفر
// ——————————————————————————————
async function saveToServer(user, { title, body, time }) {
  try {
    await fetch(`${API_BASE}/save-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, title, body, time })
    });
  } catch (e) {
    console.warn('⚠️ failed saving notif to server:', e);
  }
}

// ——————————————————————————————
// 3) الدالة الموحدة لإضافة إشعار
//    تحفظه محلياً وعلى السيرفر
// ——————————————————————————————
async function safeAddNotification({ title, body, time }) {
  try {
    // 3.1) حفظ في localStorage
    const KEY = 'notificationsLog';
    const arr = JSON.parse(localStorage.getItem(KEY) || '[]');
    arr.unshift({ title, body, time });
    if (arr.length > 50) arr.pop();
    localStorage.setItem(KEY, JSON.stringify(arr));

    // 3.2) حفظ في السيرفر
    if (window.currentUser) {
      await saveToServer(window.currentUser, { title, body, time });
    }

    // 3.3) تحديث العرض إن وجدت الدوال
    if (typeof window.renderNotifications === 'function') window.renderNotifications();
    if (typeof window.updateBellCount      === 'function') window.updateBellCount();

    console.log('📩 إشعار محفوظ:', { title, body, time });
  } catch (e) {
    console.warn('⚠️ خطأ في تخزين الإشعار:', e);
  }
}

// اجعل window.addNotification تشير إلى دالتنا
window.addNotification = safeAddNotification;

// ——————————————————————————————
// 4) تهيئة Web Push (Firebase compat)
// ——————————————————————————————
window.initNotifications = async function() {
  // 4.1 تسجيل Service Worker
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW registered:', reg.scope);
  } catch (err) {
    console.error('❌ SW registration failed:', err);
    return;
  }

  // 4.2 تهيئة Firebase-compat
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const messaging = firebase.messaging();

  // 4.3 الحصول على FCM Token
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.warn('🔕 Notification permission not granted.');
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

  // 4.4 الاستماع للرسائل الواردة في المقدمة
  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    const now = new Date().toLocaleString();
    if (title && body && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    safeAddNotification({ title, body, time: now });
  });
};

// ——————————————————————————————
// 5) دالة موحدة لتهيئة جميع الإشعارات
// ——————————————————————————————
window.initPush = async function() {
  console.log('⚙️ initPush');
  if (typeof window.initNotifications === 'function') {
    await window.initNotifications();
  }
  // لو عندك initPushNative للموبايل فاستدعها هنا
};
