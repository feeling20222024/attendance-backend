// public/js/push.js

// —————————————————————————————————————————
// إعدادات Firebase — ضع هنا كامل المفاتيح كما في الـ SW
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
// تهيئة إشعارات الويب عبر FCM
// —————————————————————————————————————————
async function initPush() {
  try {
    // 1) سجّل Firebase SW
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ Firebase SW registered:', swReg.scope);

    // 2) ابدأ Firebase
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // 3) إذن الإشعارات
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return console.warn('❌ إشعارات الويب مرفوضة');

    // 4) احصل على FCM token
    const token = await messaging.getToken({ vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: swReg });
    console.log('✅ FCM token:', token);

    // 5) أرسل التوكن للخادم
    const user = window.currentUser;
    if (!user) return console.warn('⚠️ currentUser غير مسجّل');
    await fetch(`${API_BASE}/register-token`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ user, token })
    });
    console.log('✅ تم تسجيل توكن FCM على الخادم');

    // 6) استمع للإشعارات أثناء التواجد في الواجهة
    messaging.onMessage(payload => {
      console.log('📩 foreground message:', payload);
      const { title, body } = payload.notification || {};
      if (title) new Notification(title, { body });
    });

  } catch (err) {
    console.error('❌ initPush error:', err);
  }
}

window.initPush = initPush;
