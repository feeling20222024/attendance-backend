// public/js/push.js

// —————————————————————————————————————————————————————————————
// 1) تهيئة Firebase داخل المتصفِّح وتسجيل Service Worker
// —————————————————————————————————————————————————————————————

// (أ) تعريف إعدادات Firebase
const firebaseConfig = {
  apiKey: "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain: "device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket: "device-streaming-47cbe934.firebasestorage.app",
  messagingSenderId: "235398312189",
  appId: "1:235398312189:web:8febe5e63f7b134b808e94"
};

// (ب) المفتاح العام الخاص بـ Web Push (انسخ القيمة الفعلية من Cloud Messaging)
const VAPID_PUBLIC_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// (ج) دالة لإعداد FCM داخل المتصفِّح
async function initPush() {
  try {
    // 1) سجلّ Service Worker قبل أي شيء
    const swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ Service Worker for Firebase registered:', swRegistration.scope);

    // 2) أنشئ تطبيق Firebase في المتصفّح (app) واطلب Messaging منه
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    // 3) اطلب إذن الإشعارات من المستخدم
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('⚠️ المستخدم لم يمنح إذن الإشعارات');
      return;
    }

    // 4) احصل على التوكن مع تمرير Service Worker و VAPID
    const currentToken = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swRegistration
    });

    if (!currentToken) {
      console.warn('⚠️ لم يتمكّن من الحصول على FCM token؛ ربما الـ Browser لا يدعم Push أو الإذن مرفوض');
      return;
    }

    console.log('✅ FCM Registration Token obtained:', currentToken);

    // 5) أرسل التوكن إلى الخادم ليُخزن
    if (!window.currentUser) {
      console.warn('⚠️ لم يُسجَّل المستخدم بعد، لن يُرسل التوكن للخادم');
      return;
    }

    fetch('https://dwam-app-by-omar.onrender.com/api/register-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: window.currentUser,
        token: currentToken
      })
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then(json => {
      console.log('✅ تم تسجيل توكن FCM بنجاح على الخادم:', json);
    })
    .catch(err => {
      console.error('❌ خطأ في إرسال التوكن للخادم:', err);
    });

    // 6) تعامُل مع الرسائل الواردة عندما يكون التطبيق في الواجهة (foreground)
    messaging.onMessage(payload => {
      console.log('✔️ استلمنا إشعاراً في الواجهة (foreground):', payload);
      if (payload.notification) {
        const { title, body } = payload.notification;
        new Notification(title, { body });
      }
    });

  } catch (err) {
    console.error('❌ خطأ أثناء تهيئة الإشعارات (initPush):', err);
  }
}

// نجعل الدالة متاحة عالميًّا للاستدعاء من app.js بعد تسجيل الدخول
window.initPush = initPush;
