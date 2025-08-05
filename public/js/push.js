import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getMessaging,
  getToken,
  onMessage
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js';

// —————————————————————————————————————————
// ثوابت
// —————————————————————————————————————————
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const firebaseConfig  = { /* ... */ };
const VAPID_PUBLIC_KEY = 'BIvZq29UIB5CgKiI…';

// —————————————————————————————————————————
// دالة تهيئة FCM
// —————————————————————————————————————————
export async function initPush(swReg) {
  const app       = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  try {
    const token = await getToken(messaging, {
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swReg
    });
    console.log('✅ FCM token:', token);

    if (localStorage.getItem('fcmTokenSent') !== token) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        },
        body: JSON.stringify({ token })
      });
      localStorage.setItem('fcmTokenSent', token);
      // بعدها حدّث العداد فوراً
      window.initNotifications?.();
    }

    onMessage(messaging, payload => {
  const { title='', body='' } = payload.notification||{};
  if (Notification.permission==='granted') {
    new Notification(title, { body });
  }
  window.addNotification?.({
    title,
    body,
    time: new Date().toLocaleString()   // استخدم toLocaleString بدل ISO
  });
});

// في نهاية push.js
window.initPush       = initPush;
window.initPushNative = initPushNative;
