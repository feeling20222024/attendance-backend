// public/js/notifications.js

// ——————————————————————————————————————————————————
// 1) استيراد Modular API من Firebase
// ——————————————————————————————————————————————————
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  doc,
  query,
  orderBy,
  limit,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

// ——————————————————————————————————————————————————
// 2) إعداد Firebase
// (استبدل بالقيم عندك)
// ——————————————————————————————————————————————————
const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};
const app   = initializeApp(firebaseConfig);
const db    = getFirestore(app);
const notifsCol = collection(db, 'notifications');

// ——————————————————————————————————————————————————
// 3) ثوابت واجهة المستخدم
// ——————————————————————————————————————————————————
const STORAGE_KEY    = 'notificationsLog';
const SUPERVISOR_UID = '35190'; // كود المشرف

// ——————————————————————————————————————————————————
// 4) جلب آخر 50 إشعار من Firestore
// ——————————————————————————————————————————————————
async function loadNotifications() {
  const q = query(notifsCol, orderBy('time', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ——————————————————————————————————————————————————
// 5) عرض عداد الجرس
// ——————————————————————————————————————————————————
async function updateBellCount() {
  const notifs = await loadNotifications();
  const el = document.getElementById('notifCount');
  if (!el) return;
  el.textContent = notifs.length;
  el.style.display = notifs.length > 0 ? 'inline-block' : 'none';
}

// ——————————————————————————————————————————————————
// 6) رسم لوحة الإشعارات
// ——————————————————————————————————————————————————
async function renderNotifications() {
  const list   = document.getElementById('notificationsLog');
  const clearB = document.getElementById('clearNotifications');
  if (!list || !clearB) return;

  const notifs = await loadNotifications();
  list.innerHTML = '';

  if (notifs.length === 0) {
    list.innerHTML = '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';
    clearB.classList.add('hidden');
  } else {
    notifs.forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-2';
      li.innerHTML = `
        <div class="font-semibold text-gray-800">${n.title}</div>
        <div class="text-sm text-gray-700">${n.body}</div>
        <div class="text-xs text-gray-400 mt-1">${new Date(n.time).toLocaleString()}</div>
      `;
      list.appendChild(li);
    });
    // زر المسح يظهر للمشرف فقط
    if (window.currentUser === SUPERVISOR_UID) {
      clearB.classList.remove('hidden');
    } else {
      clearB.classList.add('hidden');
    }
  }
}

// ——————————————————————————————————————————————————
// 7) مسح سجل الإشعارات (المشرف فقط)
// ——————————————————————————————————————————————————
async function clearNotifications() {
  if (window.currentUser !== SUPERVISOR_UID) {
    return alert('ليس لديك صلاحية لمسح الإشعارات');
  }
  if (!confirm('مسح جميع الإشعارات؟')) return;

  const notifs = await loadNotifications();
  await Promise.all(notifs.map(n => deleteDoc(doc(db, 'notifications', n.id))));
  await renderNotifications();
  await updateBellCount();
}

// ——————————————————————————————————————————————————
// 8) إضافة إشعار جديد (أي مكان بالواجهة أو push.js يستدعيها)
// تُخزّن في Firestore، ثم تُحدّث الواجهة
// ——————————————————————————————————————————————————
window.addNotification = async function({ title, body, time }) {
  await addDoc(notifsCol, {
    title,
    body,
    time,
    createdAt: serverTimestamp()
  });
  await updateBellCount();
  // إذا كانت اللوحة مفتوحة
  const panel = document.getElementById('notificationsPanel');
  if (panel && getComputedStyle(panel).display !== 'none') {
    await renderNotifications();
  }
};

// ——————————————————————————————————————————————————
// 9) ربط الأحداث عند تحميل الـ DOM
// ——————————————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  const bell   = document.getElementById('notifBell');
  const panel  = document.getElementById('notificationsPanel');
  const clearB = document.getElementById('clearNotifications');

  // العرض الأولي
  updateBellCount();
  renderNotifications();

  // النقر على جرس الإشعارات
  bell?.addEventListener('click', async () => {
    panel.classList.toggle('hidden');
    await renderNotifications();
    await updateBellCount();
  });

  // مسح الإشعارات
  clearB?.addEventListener('click', clearNotifications);
});

// ——————————————————————————————————————————————————
// 10) استرجاع الإشعارات عند تسجيل الدخول
// (في app.js بعد نجاح login)
// ——————————————————————————————————————————————————
// مثال في app.js:
//   if (window.currentUser) {
//     // فقط نعيد تحميل الواجهة، لأن notifications.js يقرأ من Firestore مباشرة
//     await updateBellCount();
//     await renderNotifications();
//   }
