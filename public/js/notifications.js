// public/js/notifications.js

// —————————————————————————————————————————
// 0) تهيئة Firebase + Firestore (compat)
// —————————————————————————————————————————
const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// —————————————————————————————————————————
// 1) ثوابت
// —————————————————————————————————————————
const STORAGE_KEY    = 'notificationsLog';
const SUPERVISOR_UID = '35190';

// —————————————————————————————————————————
// 2) تحميل إشعارات المستخدم من Firestore
// —————————————————————————————————————————
async function loadNotificationsFromServer() {
  if (!window.currentUser) return [];
  const snapshot = await db.collection('notifications')
    .where('user', '==', window.currentUser)
    .orderBy('time', 'desc')
    .limit(50)
    .get();
  return snapshot.docs.map(d => d.data());
}

// —————————————————————————————————————————
// 3) تحديث localStorage من السيرفر (استدعِها بعد تسجيل الدخول)
// —————————————————————————————————————————
async function syncNotifications() {
  const notifs = await loadNotificationsFromServer();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
}

// —————————————————————————————————————————
// 4) دوال العرض والعداد (مثل القديم لكن تقرأ من localStorage)
// —————————————————————————————————————————
function loadNotificationsLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function updateBellCount() {
  const count = loadNotificationsLocal().length;
  const bell = document.getElementById('notifCount');
  if (!bell) return;
  bell.textContent = count;
  bell.style.display = count > 0 ? 'inline-block' : 'none';
}

function renderNotifications() {
  const list   = document.getElementById('notificationsLog');
  const clearB = document.getElementById('clearNotifications');
  const notifs = loadNotificationsLocal();
  if (!list || !clearB) return;
  list.innerHTML = notifs.length
    ? notifs.map(n => `
      <li class="mb-2 border-b pb-2">
        <div class="font-semibold">${n.title}</div>
        <div class="text-sm">${n.body}</div>
        <div class="text-xs text-gray-500">${new Date(n.time).toLocaleString()}</div>
      </li>
    `).join('')
    : '<li class="text-gray-500">لا توجد إشعارات</li>';
  clearB.style.display = (window.currentUser === SUPERVISOR_UID && notifs.length) ? 'block' : 'none';
}

// —————————————————————————————————————————
// 5) مسح سجل الإشعارات (Firestore + localStorage)
// —————————————————————————————————————————
async function clearNotifications() {
  if (window.currentUser !== SUPERVISOR_UID) return alert('ليس لديك صلاحية.');
  if (!confirm('مسح جميع الإشعارات؟')) return;
  // حذف من السيرفر:
  const batch = db.batch();
  const snap  = await db.collection('notifications')
    .where('user','==',window.currentUser).get();
  snap.docs.forEach(d => batch.delete(d.ref));
  await batch.commit();
  // ثم مسح محليّاً:
  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  updateBellCount();
}

// —————————————————————————————————————————
// 6) ربط الأحداث عند تحميل الصفحة
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('clearNotifications').onclick = clearNotifications;
  // فقط بعد تسجيل الدخول و setting window.currentUser:
  if (window.currentUser) {
    await syncNotifications();
  }
  updateBellCount();
  renderNotifications();
  document.getElementById('notifBell').onclick = () => {
    document.getElementById('notificationsPanel').classList.toggle('hidden');
    renderNotifications();
  };
});

// ★ إتاحت الدوال للعالم الخارجي ★
window.updateBellCount       = updateBellCount;
window.renderNotifications   = renderNotifications;
window.syncNotifications     = syncNotifications;
