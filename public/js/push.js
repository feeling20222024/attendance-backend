// —————————————————————————————————————————
// 1) استيراد Firebase Messaging وUI
// —————————————————————————————————————————
import { getMessaging, getToken, onMessage } from 
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js';
import { pushNotificationToStore, addNotificationUI } from './notifications.js';

// —————————————————————————————————————————
// 2) إعداد FCM
// —————————————————————————————————————————
const VAPID = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";
const messaging = getMessaging();

// —————————————————————————————————————————
// 3) تهيئة Web Push
// —————————————————————————————————————————
export async function initPushWeb(userId) {
  // تسجيل الـ SW
  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch(e){console.warn('SW reg failed',e);}
  
  if (Notification.permission !== 'granted') {
    await Notification.requestPermission();
  }

  // جلب الـ FCM Token
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    const token = await getToken(messaging, { vapidKey: VAPID, serviceWorkerRegistration: reg });
    if (token) {
      await fetch('/api/register-token', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ user: userId, token })
      });
    }
  } catch(e){ console.warn('Token error', e); }

  // استماع للرسائل الواردة
  onMessage(messaging, payload => {
    const { title, body } = payload.notification||{};
    const now = new Date().toLocaleString();
    if (title && body) {
      new Notification(title, { body });
      // 1) إلى الواجهة
      addNotificationUI({ title, body, time: now });
      // 2) إلى Firestore
      pushNotificationToStore(userId, { title, body, time: now });
    }
  });
}

// —————————————————————————————————————————
// 4) دالة موحدة
// —————————————————————————————————————————
export async function initPush(userId) {
  await initPushWeb(userId);
  // لاحقاً يمكنك إضافة initPushNative(userId) إذا استعملت Capacitor
}
