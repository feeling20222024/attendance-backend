// public/js/push.js

// ——————————————————————————————
// 1) إعداد Firebase و VAPID
// ——————————————————————————————
const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';

const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};

const VAPID_PUBLIC_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// ——————————————————————————————
// 2) دالة آمنة لإضافة إشعار (localStorage + خادم)
// ——————————————————————————————
async function safeAddNotification({ title, body, time }) {
  try {
    // 2.1) التخزين محلياً
    const saved = JSON.parse(localStorage.getItem('notificationsLog') || '[]');
    saved.unshift({ title, body, time });
    if (saved.length > 50) saved.pop();
    localStorage.setItem('notificationsLog', JSON.stringify(saved));

    // 2.2) التخزين على الخادم
    if (window.currentUser) {
      await fetch(`${API_BASE}/save-notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          user:  window.currentUser, 
          title, 
          body, 
          time 
        })
      });
    }

    // 2.3) تحديث الواجهة
    if (typeof window.renderNotifications === 'function') {
      window.renderNotifications();
    }
    if (typeof window.updateBellCount === 'function') {
      window.updateBellCount();
    }

    console.log('📩 إشعار محفوظ:', { title, body, time });
  } catch (e) {
    console.warn('⚠️ خطأ في تخزين الإشعار:', e);
  }
}

// ——————————————————————————————
// initNotifications — للويب فقط
// ——————————————————————————————
window.initNotifications = async function () {
  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    console.log('✅ SW for Firebase registered:', reg.scope);
  } catch (err) {
    console.error('❌ فشل تسجيل SW:', err);
    // لو فشل التسجيل، نستمر بدون FCM
  }

  // تهيئة Firebase compat
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  const messaging = firebase.messaging();

  // طلب الإذن
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') {
    console.warn('🔕 إذن الإشعارات غير ممنوح');
    return;
  }

  // **غلاف شامل حول getToken**
  let fcmToken = null;
  try {
    const registration = await navigator.serviceWorker.getRegistration();
    fcmToken = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: registration
    });
    console.log('✅ FCM Token:', fcmToken);

    // إرسال التوكن للخادم
    if (fcmToken && window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token: fcmToken })
      });
      console.log('✅ أُرسل Token للسيرفر');
    }
  } catch (e) {
    console.warn('⚠️ تعذّر الحصول على FCM Token — نستمر بدون push ويب:', e);
    // مهم: لا نطرح الخطأ مجددًا حتى لا يقاطع تدفق التطبيق
  }

  // استقبال الرسائل الواردة
  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    const now = new Date().toLocaleString();
    if (title && body && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    // تخزين محلي + إرسال للخادم
    safeAddNotification({ title, body, time: now });
  });
};

// ——————————————————————————————
// 4) initPushNative — للجوال (Capacitor Native)
// ——————————————————————————————
window.initPushNative = async function () {
  let PushNotifications;
  try {
    // استيراد ديناميكي حتى لا يخطئ المتصفح
    ({ PushNotifications } = await import('@capacitor/push-notifications'));
  } catch {
    return; // بيئة ويب فقط
  }

  // 4.1) إنشاء قناة الإشعارات (Android 8+)
  await PushNotifications.createChannel({
    id: 'default',
    name: 'الإشعارات',
    description: 'الإشعارات العامة',
    importance: 5,
    vibrationPattern: [100, 200, 100],
    sound: 'default'
  }).catch(() => {});

  // 4.2) طلب إذن Push
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') {
    console.warn('🔕 إذن إشعارات الجوال غير ممنوح');
    return;
  }

  // 4.3) تسجيل الجهاز
  await PushNotifications.register();

  // 4.4) مستمع تسجيل التوكن
  PushNotifications.addListener('registration', async ({ value }) => {
    console.log('✅ Native Token:', value);
    if (window.currentUser) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: window.currentUser, token: value })
      }).catch(console.error);
    }
  });

  // 4.5) مستمع استقبال الإشعار في الـ foreground
  PushNotifications.addListener('pushNotificationReceived', notif => {
    const { title, body } = notif;
    const now = new Date().toLocaleString();

    if (title && body && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    safeAddNotification({ title, body, time: now });
  });
};

// ——————————————————————————————
// ... (الكود الموجود حالياً في public/js/push.js)

// 5) دالة موحدة لتهيئة Push
window.initPush = async function () {
  console.log('⚙️ initPush()');
  // أ) ابدأ بالويب
  if (typeof window.initNotifications === 'function') {
    await window.initNotifications();
  }
  // ب) ثم المحمول (Capacitor)
  if (typeof window.initPushNative === 'function') {
    await window.initPushNative();
  }

  // ج) أخيراً، جلب الإشعارات المخزّنة على الخادم وتخزينها محلياً
  try {
    if (window.currentUser) {
      const res = await fetch(`${API_BASE}/notifications/${window.currentUser}`);
      if (res.ok) {
        const serverNotifs = await res.json(); 
        // نتوقّع مصفوفة [{ title, body, time }, ...]
        // نخزنها في localStorage لــ notifications.js
        localStorage.setItem('notificationsLog', JSON.stringify(serverNotifs));
        // نحدّث الواجهة
        if (typeof window.renderNotifications === 'function') {
          window.renderNotifications();
        }
        if (typeof window.updateBellCount === 'function') {
          window.updateBellCount();
        }
        console.log('✅ جلب الإشعارات من الخادم وحفظها محلياً');
      } else {
        console.warn('⚠️ فشل جلب إشعارات الخادم:', res.status);
      }
    }
  } catch (e) {
    console.warn('⚠️ خطأ أثناء جلب إشعارات الخادم:', e);
  }
};
