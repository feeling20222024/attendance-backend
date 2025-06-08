// public/js/push.js

// —————————————————————————————————————————
// إعدادات Firebase — استخدم مفاتيحك هنا
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
// initPush: تهيئة إشعارات الويب عبر FCM
// —————————————————————————————————————————
async function initPush() {
  try {
    // 1) سجّل الـ Service Worker الخاص بـ Firebase (مسار الجذر)
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ Firebase SW registered:', swReg.scope);

    // 2) ابدأ تطبيق Firebase
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // 3) اطلب إذن الإشعارات من المستخدم
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('❌ المستخدم لم يمنح إذن الإشعارات');
      return;
    }

    // 4) احصل على توكن FCM مع VAPID و Service Worker
    const token = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swReg
    });
    if (!token) {
      console.warn('❌ لم يتم الحصول على FCM token');
      return;
    }
    console.log('✅ FCM token:', token);

    // 5) أرسل التوكن إلى الخادم ليتم حفظه (حتى يتم إرسال الإشعارات لاحقاً)
    if (!window.currentUser) {
      console.warn('⚠️ currentUser غير مسجّل');
    } else {
      await fetch('https://dwam-app-by-omar.onrender.com/api/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ تم تسجيل توكن FCM على الخادم');
    }

    // 6) استمع للإشعارات عند فتح التطبيق (foreground)
    messaging.onMessage(payload => {
      console.log('📩 foreground message:', payload);
      const { title, body } = payload.notification || {};
      if (title) new Notification(title, { body });
    });

  } catch (err) {
    console.error('❌ initPush error:', err);
  }
}

// نجعل الدالة متاحة عالمياً ليستدعيها app.js بعد تسجيل الدخول
window.initPush = initPush;
