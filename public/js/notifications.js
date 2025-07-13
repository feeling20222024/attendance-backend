// public/js/notifications.js

// 1) استيراد Firebase Modular API
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

// 2) إعداد Firebase (استخدم إعداداتك)
const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// 3) مفتاح التخزين المحلي
const STORAGE_KEY = 'notificationsLog';

// 4) تحميل إشعارات Firestore
async function loadNotificationsFromFirestore(user) {
  const col = collection(db, 'notifications', user, 'log');
  const q   = query(col, orderBy('time', 'desc'), limit(50));
  const snap= await getDocs(q);
  return snap.docs.map(d => d.data());
}

// 5) تحميل إشعارات من localStorage
function loadNotificationsLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

// 6) حفظ سجل في localStorage
function saveNotificationsLocal(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// 7) تحديث العداد على أيقونة الجرس
export function updateBellCount() {
  const cnt = loadNotificationsLocal().length;
  const el  = document.getElementById('notifCount');
  if (!el) return;
  el.textContent = cnt;
  el.style.display = cnt > 0 ? 'inline-block' : 'none';
}

// 8) رسم لوحة الإشعارات
export function renderNotifications() {
  const notifs = loadNotificationsLocal();
  const list   = document.getElementById('notificationsLog');
  const clr    = document.getElementById('clearNotifications');
  if (!list || !clr) return;

  list.innerHTML = '';
  if (notifs.length === 0) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    clr.classList.add('hidden');
  } else {
    notifs.forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-2';
      li.innerHTML = `
        <div class="font-semibold">${n.title}</div>
        <div class="text-sm">${n.body}</div>
        <div class="text-xs text-gray-500">${new Date(n.time).toLocaleString()}</div>
      `;
      list.appendChild(li);
    });
    clr.classList.remove('hidden');
  }
}

// 9) مسح السجل
export function clearNotifications() {
  if (!confirm('مسح جميع الإشعارات؟')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  updateBellCount();
}

// 10) دالة إضافة إشعار جديد (من push.js أو SW)
window.addNotification = async function({ title, body, time }) {
  // a) خزن محليًا
  const saved = loadNotificationsLocal();
  saved.unshift({ title, body, time });
  if (saved.length > 50) saved.pop();
  saveNotificationsLocal(saved);

  // b) خزن في Firestore
  if (window.currentUser) {
    try {
      await addDoc(
        collection(db, 'notifications', window.currentUser, 'log'),
        { title, body, time }
      );
    } catch (e) {
      console.warn('Firestore save failed:', e);
    }
  }

  // c) حدّث العرض
  renderNotifications();
  updateBellCount();
};

// 11) تحميل سجل Firestore عند بدء التشغيل
export async function initNotifications() {
  if (!window.currentUser) return;
  try {
    const fromDb = await loadNotificationsFromFirestore(window.currentUser);
    saveNotificationsLocal(fromDb);
  } catch (e) {
    console.warn('Failed to load from Firestore:', e);
  }
  renderNotifications();
  updateBellCount();
}

// 12) ربط الأحداث عند DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('notifBell')?.addEventListener('click', () => {
    const panel = document.getElementById('notificationsPanel');
    panel.classList.toggle('hidden');
    renderNotifications();
    updateBellCount();
  });
  document.getElementById('clearNotifications')?.addEventListener('click', clearNotifications);

  // تهيئة عند الدخول
  if (typeof initNotifications === 'function') initNotifications();
  updateBellCount();
});
