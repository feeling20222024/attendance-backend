// public/firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain: "device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket: "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId: "1:235398312189:web:8febe5e63f7b134b808e94"
};

// 3) تهيئة تطبيق Firebase Messaging
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 4) VAPID key (Public Key) – انسخ القيمة من: Firebase Console → Cloud Messaging → Web Push Certificates
const VAPID_PUBLIC_KEY = "BHa1ExampleVapidKey_Your_Key_Here_1234567890abcdef";

// 5) طلب إذن الإشعارات والحصول على Token
async function initPush() {
  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('المستخدم لم يمنح إذن الإشعارات');
      return;
    }

    const currentToken = await messaging.getToken({ vapidKey: VAPID_PUBLIC_KEY });
    if (currentToken) {
      console.log('✅ FCM Registration Token:', currentToken);
      if (!window.currentUser) {
        console.warn('لم يُسَجَّل المستخدم بعد، لن يُرسل التوكن');
        return;
      }

      await fetch('https://dwam-app-by-omar.onrender.com/api/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token: currentToken })
      });
      console.log('تم تسجيل توكن FCM بنجاح على الخادم');
    } else {
      console.warn('لم يتمكَّن من الحصول على FCM token');
    }
  } catch (err) {
    console.error('خطأ أثناء محاولة الحصول على الإذن أو التوكن:', err);
  }
}

// 6) استقبال الرسائل أثناء تشغيل التطبيق في الواجهة
messaging.onMessage(payload => {
  console.log('✔️ استلمنا إشعاراً في الواجهة (foreground):', payload);
  if (payload.notification) {
    const { title, body } = payload.notification;
    new Notification(title, { body });
  }
});

window.initPush = initPush;
