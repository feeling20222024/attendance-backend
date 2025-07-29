// public/js/push.js
// —————————————————————————————————————————
// 0) استيراد مكتبات Firebase فقط للويب
// —————————————————————————————————————————
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import {
  getMessaging,
  getToken,
  onMessage
} from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js';

// —————————————————————————————————————————
// 1) ثوابت الإعداد
// —————————————————————————————————————————
const API_BASE       = 'https://dwam-app-by-omar.onrender.com/api';
const firebaseConfig = { /* ... */ };
const VAPID_KEY      = 'BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ';

// —————————————————————————————————————————
// 2) تهيئة إشعارات الويب (FCM)
// —————————————————————————————————————————
export async function initPush() {
  const app       = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  let token;
  try {
    token = await getToken(messaging, { vapidKey: VAPID_KEY });
    console.log('✅ FCM token:', token);
  } catch (err) {
    console.error('❌ getToken failed:', err);
    return;
  }

  // إرسال إلى السيرفر لمرة واحدة
  if (localStorage.getItem('fcmTokenSent') !== token) {
    try {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ user: window.currentUser, token })
      });
      localStorage.setItem('fcmTokenSent', token);
    } catch(e) {
      console.error('❌ register-token failed:', e);
    }
  }

  // استقبال الرسائل في الواجهة
  onMessage(messaging, payload => {
    const { title='', body='' } = payload.notification || {};
    if (Notification.permission === 'granted') new Notification(title, { body });
    if (typeof window.addNotification === 'function') {
      window.addNotification({ title, body, time: new Date().toISOString() });
    }
  });
}

// —————————————————————————————————————————
// 3) تهيئة إشعارات Native (Capacitor)
// —————————————————————————————————————————
export async function initPushNative() {
  // 3.1) حمل مكتبة PushNotifications ديناميكيًا
  let PushNotifications;
  try {
    ({ PushNotifications } = await import('https://unpkg.com/@capacitor/push-notifications/dist/esm/index.js'));
  } catch (e) {
    console.warn('⚠️ Dynamic import of Capacitor failed:', e);
    return;
  }

  // 3.2) أنشئ القناة واطلب الأذونات
  try {
    await PushNotifications.createChannel({ id:'default', name:'الإشعارات الرئيسية', importance:5, vibrationPattern:[100,200,100], sound:'default' });
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return;
    await PushNotifications.register();
  } catch (e) {
    console.warn('⚠️ Native init failed:', e);
    return;
  }

  // 3.3) مستمع التوكن
  PushNotifications.addListener('registration', ({ value }) => {
    console.log('✅ Native token:', value);
    fetch(`${API_BASE}/register-token`, {
      method:'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ user: window.currentUser, token:value })
    }).catch(console.error);
  });

  // 3.4) مستمع استقبال الإشعارات بالـforeground
  PushNotifications.addListener('pushNotificationReceived', notif => {
    const { title='', body='' } = notif;
    if (Notification.permission === 'granted') {
      new Notification(title, { body, data: notif.data, vibrate:[100,200,100], tag:'default' });
    }
    if (typeof window.addNotification === 'function') {
      window.addNotification({ title, body, time: new Date().toISOString() });
    }
  });

  // 3.5) مستمع النقر على الإشعار
  PushNotifications.addListener('pushNotificationActionPerformed', action => {
    console.log('➡️ Native action:', action);
  });
}

// —————————————————————————————————————————
// 4) ربط الدوال على window
// —————————————————————————————————————————
window.initPush       = initPush;
window.initPushNative = initPushNative;
