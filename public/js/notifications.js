// public/js/notifications.js

// —————————————————————————————————————————————————————————————
// 0) استيراد Firebase Modular API
// —————————————————————————————————————————————————————————————
import { initializeApp }       from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getAuth }             from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

// —————————————————————————————————————————————————————————————
// 1) إعداد Firebase
// (ضع هنا إعداداتك الخاصة)
const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};

const app   = initializeApp(firebaseConfig);
const auth  = getAuth(app);
const db    = getFirestore(app);

// —————————————————————————————————————————————————————————————
// 2) ثوابت العرض والمحلي
// —————————————————————————————————————————————————————————————
const STORAGE_KEY     = 'notificationsLog';
const SUPERVISOR_UID  = '35190';   // أو أي معرّف تستخدمه للمشرف

// —————————————————————————————————————————————————————————————
// 3) دوال التخزين المحلّي (localStorage)
// —————————————————————————————————————————————————————————————
function loadNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveNotificationsLocal(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// —————————————————————————————————————————————————————————————
// 4) تحديث عداد الجرس
// —————————————————————————————————————————————————————————————
function updateBellCount() {
  const count = loadNotifications().length;
  const bellCount = document.getElementById('notifCount');
  if (!bellCount) return;
  bellCount.textContent = count;
  bellCount.style.display = count > 0 ? 'inline-block' : 'none';
}

// —————————————————————————————————————————————————————————————
// 5) رسم محتوى لوحة الإشعارات
// —————————————————————————————————————————————————————————————
function renderNotifications() {
  const list   = document.getElementById('notificationsLog');
  const clearB = document.getElementById('clearNotifications');
  const notifs = loadNotifications();
  if (!list || !clearB) return;

  list.innerHTML = '';
  if (notifs.length === 0) {
    list.innerHTML = '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';
  } else {
    notifs.forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-4 border-b pb-2';
      li.innerHTML = `
        <div class="font-semibold text-gray-800">${n.title}</div>
        <div class="text-sm text-gray-700">${n.body}</div>
        <div class="text-xs text-gray-400 mt-1">${n.time}</div>
      `;
      list.appendChild(li);
    });
  }

  // أظهر زر المسح فقط للمشرف
  if (auth.currentUser?.uid === SUPERVISOR_UID && notifs.length > 0) {
    clearB.classList.remove('hidden');
  } else {
    clearB.classList.add('hidden');
  }
}

// —————————————————————————————————————————————————————————————
// 6) مسح سجل الإشعارات (للمشرف فقط)
// —————————————————————————————————————————————————————————————
function clearNotifications() {
  if (auth.currentUser?.uid !== SUPERVISOR_UID) {
    alert('ليس لديك صلاحية لمسح سجل الإشعارات.');
    return;
  }
  if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  updateBellCount();
}

// —————————————————————————————————————————————————————————————
// 7) إضافة إشعار جديد (محلي + Firestore)
// يُستدعى عبر window.addNotification(payload)
// —————————————————————————————————————————————————————————————
window.addNotification = async function(payload) {
  // خزن محليًا
  const saved = loadNotifications();
  saved.unshift({ title: payload.title, body: payload.body, time: payload.time });
  if (saved.length > 50) saved.pop();
  saveNotificationsLocal(saved);

  // خزن في Firestore تحت مسار: /users/{uid}/notifications
  try {
    const user = auth.currentUser;
    if (user) {
      const userNotifsCol = collection(doc(collection(db, 'users'), user.uid), 'notifications');
      await addDoc(userNotifsCol, {
        title:     payload.title,
        body:      payload.body,
        time:      payload.time,
        createdAt: serverTimestamp()
      });
    }
  } catch (e) {
    console.warn('Firestore save failed:', e);
  }

  // إعادة التحديث إذا كانت اللوحة مفتوحة
  const panel = document.getElementById('notificationsPanel');
  if (panel && getComputedStyle(panel).display !== 'none') {
    renderNotifications();
  }
  updateBellCount();
};

// —————————————————————————————————————————————————————————————
// 8) ربط الأحداث عند تحميل الـ DOM
// —————————————————————————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  const bell   = document.getElementById('notifBell');
  const panel  = document.getElementById('notificationsPanel');
  const clearB = document.getElementById('clearNotifications');

  updateBellCount();
  renderNotifications();

  bell?.addEventListener('click', () => {
    const isHidden = panel.classList.contains('hidden') || getComputedStyle(panel).display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    panel.classList.toggle('hidden');
    renderNotifications();
    updateBellCount();
  });

  clearB?.addEventListener('click', clearNotifications);
});
