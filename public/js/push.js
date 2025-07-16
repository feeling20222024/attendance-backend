//  == public/js/push.js ==
// 1) استيراد Firebase Messaging
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js';
import { addNotification } from './notifications.js';  // دوال التخزين والرفع

const firebaseConfig = { /* نفس الإعدادات */ };
const VAPID_PUBLIC_KEY = "…";

initializeApp(firebaseConfig);
const messaging = getMessaging();

export async function initPush() {
  // سجل SW
  await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(console.error);
  // طلب إذن ثمّ التوكن
  if (await Notification.requestPermission() !== 'granted') return;
  const reg   = await navigator.serviceWorker.getRegistration();
  const token = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: reg });
  // أرسل إلى خادمك إذا أردت…
  // استمع للرسائل الواردة
  onMessage(messaging, payload => {
    const { title, body } = payload.notification;
    // عرض Notification API
    new Notification(title, { body });
    // خزن في Firestore وDOM
    addNotification({ title, body });
  });
}
