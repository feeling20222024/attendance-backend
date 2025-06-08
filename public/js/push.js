// public/js/push.js
// —————————————————————————————————————————
//  إعدادات Firebase — استخدم مفاتيحك هنا
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
async function initPush() {
  try {
-   const swReg = await navigator.serviceWorker.getRegistration();
+   const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return console.warn('لم يمنح إذن إشعارات');

-   const token = await messaging.getToken({
-     vapidKey: VAPID_PUBLIC_KEY,
-     serviceWorkerRegistration: swReg
-   });
+   const token = await messaging.getToken({ vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: swReg });
    if (!token) return console.warn('❌ لم يتم الحصول على FCM token');
    console.log('✅ FCM token:', token);

    // إرسال التوكن مع التأكد من وجود currentUser
    await fetch('https://dwam-app-by-omar.onrender.com/api/register-token', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ user: window.currentUser, token })
    });

    // الاستماع للإشعارات في الواجهة
    messaging.onMessage(payload => {
      const { title, body } = payload.notification || {};
      if (title) new Notification(title, { body });
    });
  } catch (err) {
    console.error('❌ initPush error:', err);
  }
}

window.initPush = initPush;
