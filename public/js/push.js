// public/js/push.js

// 1) إعداد Firebase (compat)
firebase.initializeApp({
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
});

// 2) احصل على messaging
const messaging = firebase.messaging();

// 3) تسجيل الـ Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then(reg => {
      console.log('✅ FCM SW registered:', reg.scope);
      messaging.useServiceWorker(reg);
    })
    .catch(err => console.error('❌ SW reg failed', err));
}

// 4) طلب إذن الإشعارات والحصول على Token
export async function initPush() {
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      console.warn('🔕 Notification permission not granted.');
      return;
    }

    const token = await messaging.getToken({
      vapidKey: "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ"
    });
    console.log('✅ FCM Token:', token);

    if (token && window.currentUser) {
      await fetch('https://dwam-app-by-omar.onrender.com/api/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token })
      });
      console.log('✅ Token sent to server');
    }
  } catch (e) {
    console.error('❌ initPush error:', e);
  }

  // 5) الاستماع للرسائل الواردة
  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    console.log('📩 FCM Message:', title, body);
    if (Notification.permission === 'granted' && title && body) {
      new Notification(title, { body });
      window.addNotification({ title, body, time: new Date().toLocaleString() });
    }
  });
}
