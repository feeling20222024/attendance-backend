// public/js/push.js
// ——————————————————————————————
// 1) استيراد الإعدادات المشتركة
// ——————————————————————————————
import { API_BASE, messaging } from './config.js';

const VAPID_PUBLIC_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// ——————————————————————————————
// 2) دالة تخزين مُوحّد وآمن
// ——————————————————————————————
async function safeAddNotification({ title, body, time }) {
  try {
    // حفظ في localStorage
    const saved = JSON.parse(localStorage.getItem('notificationsLog') || '[]');
    saved.unshift({ title, body, time });
    if (saved.length > 50) saved.pop();
    localStorage.setItem('notificationsLog', JSON.stringify(saved));

    // حفظ في الخادم
    if (window.currentUser) {
      await fetch(`${API_BASE}/save-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, title, body, time })
      });
    }

    if (typeof window.renderNotifications === 'function') window.renderNotifications();
    if (typeof window.updateBellCount === 'function') window.updateBellCount();
  } catch (e) {
    console.warn('⚠️ خطأ في تخزين الإشعار المُوحّد:', e);
  }
}

// ——————————————————————————————
// 3) initPushWeb: تهيئة الـ SW، التوكن، والاستماع للرسائل
// ——————————————————————————————
export async function initPushWeb() {
  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch (e) {
    console.error('❌ فشل تسجيل SW:', e);
    return;
  }

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const token = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });
    if (token && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
    }
  } catch (e) {
    console.warn('⚠️ لم نتمكن من الحصول على FCM token:', e);
  }

  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    const now = new Date().toLocaleString();
    if (title && body) {
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      }
      safeAddNotification({ title, body, time: now });
    }
  });
}

// ——————————————————————————————
// 4) initPushNative: تهيئة إشعارات الجوال (Capacitor)
// ——————————————————————————————
export async function initPushNative() {
  let PushNotifications;
  try {
    ({ PushNotifications } = await import('@capacitor/push-notifications'));
  } catch {
    return;
  }

  await PushNotifications.createChannel({ id:'default', name:'الإشعارات', importance:5 }).catch(()=>{});
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return;
  await PushNotifications.register();

  PushNotifications.addListener('pushNotificationReceived', notif => {
    const { title, body } = notif;
    const now = new Date().toLocaleString();
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    safeAddNotification({ title, body, time: now });
  });
}

// ——————————————————————————————
// 5) دالة موحّدة لاستدعاء الاثنين
// ——————————————————————————————
export async function initPush() {
  await initPushWeb();
  await initPushNative();
}
