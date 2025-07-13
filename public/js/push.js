// public/js/push.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getMessaging, getToken, onMessage } 
  from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js';
import { API_BASE, firebaseConfig, VAPID_PUBLIC_KEY } from './config.js';

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

export async function initPush() {
  // 1) سجل الـ SW
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW registered:', reg.scope);
  } catch (e) {
    console.warn('❌ SW failed:', e);
    return;
  }

  // 2) احصل على Token
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const token = await getToken(messaging, {
        vapidKey: VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: reg
      });
      console.log('✅ FCM token:', token);
      // إرسال السيرفر ...
    } catch (e) {
      console.warn('⚠️ Could not get token:', e);
    }
  }

  // 3) استمع للرسائل الواردة في الويب
  onMessage(messaging, payload => {
    const { title, body } = payload.notification || {};
    const now = Date.now();
    // **هنا** تستدعي التخزين المركزي:
    window.addNotification({ title, body, time: now });
    // وتعرض Notification system
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  });
}
