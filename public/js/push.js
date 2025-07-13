// public/js/push.js

// 1) إعداد Firebase compat + Messaging
const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';
const firebaseConfig = { /* كما في الأعلى */ };
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();
const db = firebase.firestore();

// 2) دالة موحّدة للحفظ (local + server)
async function safeAddNotification({ title, body, time }) {
  // 1) ضبط الكائن
  const notif = { user: window.currentUser, title, body, time };
  // 2) حفظ على السيرفر
  try {
    await db.collection('notifications').add(notif);
  } catch (e) {
    console.warn('❌ لم يتم الحفظ على السيرفر:', e);
  }
  // 3) حفظ محليّاً
  window.addNotification({ title, body, time });
}

// 3) تهيئة إشعارات الويب
export async function initPushWeb() {
  // تسجيل الـ SW
  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch (e) {
    console.warn('❌ SW reg failed:', e);
  }
  // طلب إذن
  if (await Notification.requestPermission() !== 'granted') return;
  // الحصول على token
  try {
    const token = await messaging.getToken({ vapidKey: 'BIvZq29...' });
    if (token) await fetch(`${API_BASE}/register-token`, { /* كما قبل */ });
  } catch (e) {
    console.warn('⚠️ لم نتمكّن من جلب التوكن:', e);
  }
  // استماع للرسائل
  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    const now = Date.now();
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
    safeAddNotification({ title, body, time: now });
  });
}

// 4) تهيئة Native (Capacitor) — مثال مبسط
export async function initPushNative() {
  let PushNotifications;
  try { ({ PushNotifications } = await import('@capacitor/push-notifications')); }
  catch { return; }
  await PushNotifications.createChannel({ id:'default', name:'الإشعارات', importance:5 });
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return;
  await PushNotifications.register();
  PushNotifications.addListener('pushNotificationReceived', notif => {
    const now = Date.now();
    new Notification(notif.title, { body: notif.body });
    safeAddNotification({ title: notif.title, body: notif.body, time: now });
  });
}

// 5) استدعاء موحّد
export async function initPush() {
  await initPushWeb();
  await initPushNative();
}

// ★ expose to window
window.initPush = initPush;
window.addNotification = ({ title, body, time }) => {
  // فقط لإدارة localStorage (كما في notifications.js):
  const arr = JSON.parse(localStorage.getItem('notificationsLog')||'[]');
  arr.unshift({ title, body, time });
  if (arr.length>50) arr.pop();
  localStorage.setItem('notificationsLog', JSON.stringify(arr));
};
