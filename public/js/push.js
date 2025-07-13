// public/js/push.js

// 1) استيراد Firebase Messaging
import { getMessaging, getToken, onMessage } from
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js';

// 2) نقاط النهاية وتكوين FCM
const API_BASE      = 'https://dwam-app-by-omar.onrender.com/api';
const VAPID_KEY     = 'BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ';
const messaging     = getMessaging();

// 3) دالة موحّدة لإضافة إشعار
function safeAddNotification({ title, body, time }) {
  // 3.1 خزّن في localStorage
  const key = 'notificationsLog';
  const arr = JSON.parse(localStorage.getItem(key) || '[]');
  arr.unshift({ title, body, time });
  if (arr.length > 50) arr.pop();
  localStorage.setItem(key, JSON.stringify(arr));

  // 3.2 خزّن في الخادم
  if (window.currentUser) {
    fetch(`${API_BASE}/save-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: window.currentUser, title, body, time })
    }).catch(console.warn);
  }

  // 3.3 راجع الواجهة
  if (typeof window.renderNotifications === 'function') window.renderNotifications();
  if (typeof window.updateBellCount      === 'function') window.updateBellCount();
}

// 4) تهيئة Web Push
export async function initPushWeb() {
  // 4.1 تسجيل Service Worker
  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW registered');
  } catch (e) {
    console.warn('⚠️ SW registration failed:', e);
    return;
  }

  // 4.2 طلب إذن
  if (Notification.permission !== 'granted') {
    await Notification.requestPermission();
  }
  if (Notification.permission !== 'granted') {
    console.warn('🔕 Notification permission not granted.');
    return;
  }

  // 4.3 الحصول على FCM token
  try {
    const reg   = await navigator.serviceWorker.getRegistration();
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    console.log('✅ FCM token:', token);
    if (token && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ token sent to server');
    }
  } catch (e) {
    console.warn('⚠️ Unable to get/send FCM token, continuing:', e);
  }

  // 4.4 استماع للرسائل الواردة في الواجهة
  onMessage(messaging, payload => {
    const { title, body } = payload.notification || {};
    const now = new Date().toLocaleString();
    if (title && body) {
      new Notification(title, { body });
      safeAddNotification({ title, body, time: now });
    }
  });
}

// 5) دالة موحّدة لاستدعاء Web + (Native لاحقًا)
export async function initPush(userId) {
  window.currentUser = userId;
  await initPushWeb();
}
