// public/js/notifications.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

// —————————————————————————————————————————
// 1) إعداد Firebase
// —————————————————————————————————————————
const firebaseConfig = {
  apiKey:           "AIzaSyClFXni…",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:…"
};
initializeApp(firebaseConfig);
const db = getFirestore();

// —————————————————————————————————————————
// 2) ثوابت التخزين والعرض
// —————————————————————————————————————————
const STORAGE_KEY    = 'notificationsLog';
const SUPERVISOR_UID = '35190';

// —————————————————————————————————————————
// 3) دوال التخزين المحلي
// —————————————————————————————————————————
function loadNotifications() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveNotificationsLocal(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// —————————————————————————————————————————
// 4) تحديث عداد الجرس
// —————————————————————————————————————————
function updateBellCount() {
  const count = loadNotifications().length;
  const bellCount = document.getElementById('notifCount');
  if (!bellCount) return;
  bellCount.textContent = count;
  bellCount.style.display = count > 0 ? 'inline-block' : 'none';
}

// —————————————————————————————————————————
// 5) رسم اللوحة
// —————————————————————————————————————————
function renderNotifications() {
  const list   = document.getElementById('notificationsLog');
  const clearB = document.getElementById('clearNotifications');
  const notifs = loadNotifications();
  if (!list || !clearB) return;

  list.innerHTML = notifs.length
    ? notifs.map(n => `
        <li class="mb-4 border-b pb-2">
          <div class="font-semibold">${n.title}</div>
          <div class="text-sm">${n.body}</div>
          <div class="text-xs text-gray-400 mt-1">${n.time}</div>
        </li>
      `).join('')
    : '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';

  // إظهار زر المسح للمشرف فقط
  if (window.currentUser === SUPERVISOR_UID && notifs.length > 0) {
    clearB.classList.remove('hidden');
  } else {
    clearB.classList.add('hidden');
  }
}

// —————————————————————————————————————————
// 6) مسح السجل
// —————————————————————————————————————————
function clearNotifications() {
  if (window.currentUser !== SUPERVISOR_UID) {
    alert('ليس لديك صلاحية لمسح سجل الإشعارات.');
    return;
  }
  if (!confirm('هل أنت متأكد؟')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  updateBellCount();
}

// —————————————————————————————————————————
// 7) إضافة إشعار جديد
// —————————————————————————————————————————
window.addNotification = async function(payload) {
  // 7.1 حفظ محلي
  const saved = loadNotifications();
  saved.unshift({ title: payload.title, body: payload.body, time: payload.time });
  if (saved.length > 50) saved.pop();
  saveNotificationsLocal(saved);

  // 7.2 حفظ في Firestore تحت /users/{uid}/notifications
  try {
    if (window.currentUser) {
      const colRef = collection(db, 'users', window.currentUser, 'notifications');
      await addDoc(colRef, {
        title:     payload.title,
        body:      payload.body,
        time:      payload.time,
        createdAt: serverTimestamp()
      });
    }
  } catch (e) {
    console.warn('Firestore save failed:', e);
  }

  // 7.3 إعادة رسم
  const panel = document.getElementById('notificationsPanel');
  if (panel && getComputedStyle(panel).display !== 'none') {
    renderNotifications();
  }
  updateBellCount();
};

// —————————————————————————————————————————
// 8) تهيئة الأحداث بعد التحميل
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('notifBell')?.addEventListener('click', () => {
    const panel = document.getElementById('notificationsPanel');
    panel.classList.toggle('hidden');
    renderNotifications();
    updateBellCount();
  });
  document.getElementById('clearNotifications')?.addEventListener('click', clearNotifications);

  renderNotifications();
  updateBellCount();
});
