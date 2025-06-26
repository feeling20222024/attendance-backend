// push.js

// —————————————————————————————————————————
// 1) نقطة النهاية للـ API
// —————————————————————————————————————————
const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';

// —————————————————————————————————————————
// 2) إعدادات Firebase (مطابقة firebase-messaging-sw.js)
// —————————————————————————————————————————
const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};
const VAPID_PUBLIC_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// —————————————————————————————————————————
// 3) دالة تخزين الإشعار وتحديث اللوحة
// —————————————————————————————————————————
window.addNotification = ({ title, body, time }) => {
  const saved = JSON.parse(localStorage.getItem('notifications') || '[]');
  saved.unshift({ title, body, time });
  localStorage.setItem('notifications', JSON.stringify(saved));
};

export async function initPushNative() {
  const { PushNotifications } = Capacitor.Plugins;
  if (!PushNotifications) return;

  // طلب الأذونات
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return;

  // تسجيل الجهاز
  await PushNotifications.register();

  // مستمع تسجيل التوكن
  PushNotifications.addListener('registration', ({ value }) => {
    console.log('✅ Native token:', value);
    if (window.currentUser) {
      fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ user: window.currentUser, token: value })
      }).catch(console.error);
    }
  });

  // مستمع استقبال الإشعار في الـ foreground
  PushNotifications.addListener('pushNotificationReceived', notif => {
    console.log('📩 pushReceived (native):', notif);
    // عرض banner محلي
    if (Notification.permission === 'granted') {
      new Notification(notif.title, { body: notif.body });
    }
    window.addNotification({
      title: notif.title,
      body: notif.body,
      time: new Date().toLocaleString()
    });
  });

  // مستمع عند النقر على الإشعار
  PushNotifications.addListener('pushNotificationActionPerformed', action => {
    console.log('➡️ Native action:', action);
  });
}
