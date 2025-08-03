// —————————————————————————————————————————
// استيراد مكتبات Firebase (Web modular API)
// —————————————————————————————————————————
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getMessaging,
  getToken,
  onMessage
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js';

// —————————————————————————————————————————
// ثوابت إعداد Firebase
// —————————————————————————————————————————
const firebaseConfig = {
  apiKey: "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain: "device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket: "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId: "1:235398312189:web:8febe5e63f7b134b808e94"
};
const VAPID_PUBLIC_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// —————————————————————————————————————————
// دالة تهيئة إشعارات الويب (FCM)
// —————————————————————————————————————————
export async function initPush(serviceWorkerRegistration) {
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration
    });
    console.log('✅ FCM token:', token);

    // إرسال التوكن للخادم مرة واحدة
    if (localStorage.getItem('fcmTokenSent') !== token) {
      await fetch('/api/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      localStorage.setItem('fcmTokenSent', token);
    }
  } catch (err) {
    console.error('❌ getToken failed:', err);
    return;
  }

  // استقبال الرسائل في المقدمة
  onMessage(messaging, payload => {
    const { title = '', body = '' } = payload.notification || {};
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    if (typeof window.addNotification === 'function') {
      window.addNotification({ title, body, time: new Date().toLocaleString() });
    }
  });
}

// —————————————————————————————————————————
// دالة تهيئة إشعارات Native (Capacitor)
// —————————————————————————————————————————
export async function initPushNative() {
  let PushNotifications;
  try {
    ({ PushNotifications } = await import('https://unpkg.com/@capacitor/push-notifications/dist/esm/index.js'));
  } catch {
    return console.warn('⚠️ Capacitor PushNotifications unavailable');
  }

  await PushNotifications.createChannel({ id:'default', name:'الإشعارات', importance:5 });
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return;
  await PushNotifications.register();

  PushNotifications.addListener('registration', ({ value }) => {
    fetch('/api/register-token', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ user: window.currentUser, token: value })
    }).catch(console.error);
  });

  PushNotifications.addListener('pushNotificationReceived', notif => {
    const { title='', body='' } = notif;
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    if (typeof window.addNotification === 'function') {
      window.addNotification({ title, body, time: new Date().toLocaleString() });
    }
  });
}

// —————————————————————————————————————————
// ربط الدوال
// —————————————————————————————————————————
window.initPush = initPush;
window.initPushNative = initPushNative;
