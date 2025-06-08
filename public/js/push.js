// public/js/push.js

// —————————————————————————————————————————
// (أ) إعدادات Firebase (مفاتيحك الخاصة)
// —————————————————————————————————————————
const firebaseConfig = {
  apiKey: "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain: "device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket: "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId: "1:235398312189:web:8febe5e63f7b134b808e94"
};

// —————————————————————————————————————————
// (ب) مفتاح VAPID الخاصّ بالويب
// —————————————————————————————————————————
const VAPID_PUBLIC_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

async function initPush() {
  try {
    // 1) سجلّ Service Worker الخاصّ بـ Firebase
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ Service Worker for Firebase registered:', swRegistration.scope);

    // 2) جهّز تطبيق Firebase واحصل على Messaging
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // 3) اطلب إذن الإشعارات من المستخدم
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('المستخدم لم يمنح إذن الإشعارات');
      return;
    }

    // 4) احصل على توكن FCM مخصّص لهذا المتصفح
    const currentToken = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swRegistration
    });
    if (!currentToken) {
      console.warn('لم يتمكّن من الحصول على FCM token');
      return;
    }

    console.log('✅ FCM Registration Token obtained:', currentToken);

    // 5) تأكد أنّ window.currentUser جاهز ثمّ أرسل التوكن للخادم
    if (!window.currentUser) {
      console.warn('لم يُسجَّل المستخدم بعد، لن يُرسل التوكن للخادم');
      return;
    }
    await fetch('https://dwam-app-by-omar.onrender.com/api/register-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user: window.currentUser, token: currentToken })
    });
    console.log('✅ تم تسجيل توكن FCM بنجاح على الخادم');

    // 6) استقبال الإشعارات عند تواجد التطبيق في الواجهة (foreground)
    messaging.onMessage(payload => {
      console.log('✔️ استلمنا إشعاراً في الواجهة (foreground):', payload);
      if (payload.notification) {
        const { title, body } = payload.notification;
        new Notification(title, { body });
      }
    });

  } catch (err) {
    console.error('خطأ أثناء تهيئة الإشعارات (initPush):', err);
  }
}

// نجعل الدالة متاحة عالميًّا للاستدعاء من app.js
window.initPush = initPush;
