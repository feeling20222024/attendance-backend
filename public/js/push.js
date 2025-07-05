// public/js/push.js

// —————————————————————————————————————————
// 1) نقطة النهاية للـ API
// —————————————————————————————————————————
const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';

// —————————————————————————————————————————
// 2) إعدادات Firebase (مطابقة firebase-messaging-sw.js)
// —————————————————————————————————————————
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getMessaging,
  getToken,
  onMessage
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js';

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
  if (saved.length > 50) saved.pop(); // احتفظ بآخر 50 إشعار
  localStorage.setItem('notifications', JSON.stringify(saved));
};

// —————————————————————————————————————————
// 4) تهيئة إشعارات الويب (FCM)
// —————————————————————————————————————————
export async function initPush() {
  // 1) طلب إذن الإشعارات
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    console.warn('🔕 إذن الإشعارات غير ممنوح');
    return;
  }

  // 2) تهيئة Firebase Messaging
  const app = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  // 3) طلب توكن FCM
  let token;
  try {
    token = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY });
    console.log('✅ FCM Registration Token obtained:', token);
  } catch (err) {
    console.error('❌ Failed to get FCM token:', err);
    return;
  }

  // 4) تفادي الإرسال المزدوج
  const last = localStorage.getItem('fcmTokenSent');
  if (last === token) {
    console.log('🔸 FCM token already sent, skip.');
  } else {
    try {
      // إرسال التوكن إلى السيرفر
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ FCM token sent to server');
      localStorage.setItem('fcmTokenSent', token);
    } catch (err) {
      console.error('❌ Failed to send FCM token to server:', err);
    }
  }

  // 5) استماع للرسائل الواردة في الواجهة
  onMessage(messaging, payload => {
    const { title, body } = payload.notification || {};
    console.log('📩 FCM onMessage:', title, body);
    // عرض إشعار نظامي
    new Notification(title, { body });
    // حفظه في اللوحة
    window.addNotification({ title, body, time: new Date().toLocaleString() });
  });
}

// —————————————————————————————————————————
// 5) تهيئة إشعارات التطبيق (Capacitor Native)
// —————————————————————————————————————————
import { PushNotifications as CN } from '@capacitor/push-notifications';

export async function initPushNative() {
  // إذا أنت تعمل على الويب، اخرج
  if (!CN) return;

  // إنشاء القناة الأولى (يُفضّل استدعاء هذا قبل طلب الأذونات)
  try {
    await CN.createChannel({
      id: 'default',
      name: 'الإشعارات الرئيسية',
      description: 'القناة الأساسية لإشعارات التطبيق',
      importance: 5,
      vibrationPattern: [100, 200, 100],
      sound: 'default'
    });
    console.log('🔔 قناة default أنشئت بصوت واهتزاز');
  } catch (e) {
    console.warn('⚠️ فشل إنشاء القناة:', e);
  }

  // طلب الأذونات
  const perm = await CN.requestPermissions();
  if (perm.receive !== 'granted') return;

  // تسجيل الجهاز
  await CN.register();

  // مستمع تسجيل التوكن
  CN.addListener('registration', ({ value: nativeToken }) => {
    console.log('✅ Native token:', nativeToken);
    if (window.currentUser) {
      fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token: nativeToken })
      }).catch(console.error);
    }
  });

  // مستمع استقبال الإشعار في الـ foreground
  CN.addListener('pushNotificationReceived', notif => {
    console.log('📩 pushReceived (native):', notif);
    new Notification(notif.title, { body: notif.body });
    window.addNotification({
      title: notif.title,
      body: notif.body,
      time: new Date().toLocaleString()
    });
  });

  // مستمع عند النقر على الإشعار
  CN.addListener('pushNotificationActionPerformed', action => {
    console.log('➡️ Native action:', action);
  });
}
