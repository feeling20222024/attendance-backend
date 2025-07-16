// public/js/notifications.js

// —————————————————————————————————————————
// 1) استيراد Modular API من Firebase
// —————————————————————————————————————————
import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  addDoc,
  deleteDoc,
  doc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js';

// —————————————————————————————————————————
// 2) إعداد Firebase
// —————————————————————————————————————————
const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// —————————————————————————————————————————
// 3) دوال العرض
// —————————————————————————————————————————
async function loadNotifications() {
  const user = auth.currentUser;
  if (!user) return [];
  const col = collection(db, 'users', user.uid, 'notifications');
  const q   = query(col, orderBy('time', 'desc'), limit(50));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function updateBellCount() {
  const notifs = await loadNotifications();
  const bell   = document.getElementById('notifCount');
  if (!bell) return;
  bell.textContent = notifs.length;
  bell.style.display = notifs.length ? 'inline-block' : 'none';
}

async function renderNotifications() {
  const list   = document.getElementById('notificationsLog');
  const clearB = document.getElementById('clearNotifications');
  if (!list || !clearB) return;
  const notifs = await loadNotifications();
  list.innerHTML = '';
  if (!notifs.length) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    clearB.classList.add('hidden');
    return;
  }
  notifs.forEach(n => {
    const li = document.createElement('li');
    li.className = 'mb-2 border-b pb-2';
    li.innerHTML = `
      <div class="font-semibold">${n.title}</div>
      <div class="text-sm">${n.body}</div>
      <div class="text-xs text-gray-400">${new Date(n.time).toLocaleString()}</div>
    `;
    list.appendChild(li);
  });
  clearB.classList.toggle('hidden', auth.currentUser?.uid !== '35190');
}

// —————————————————————————————————————————
// 4) مسح الإشعارات (للمشرف فقط)
// —————————————————————————————————————————
async function clearNotifications() {
  if (auth.currentUser?.uid !== '35190') return;
  if (!confirm('مسح جميع الإشعارات؟')) return;
  const ns = await loadNotifications();
  await Promise.all(ns.map(n => deleteDoc(doc(db, 'users', auth.currentUser.uid, 'notifications', n.id))));
  await renderNotifications();
  await updateBellCount();
}

// —————————————————————————————————————————
// 5) إضافة إشعار جديد
// (يمكنك استدعاؤها من push.js أو SW)
// —————————————————————————————————————————
window.addNotification = async function({ title, body, time }) {
  const user = auth.currentUser;
  if (!user) return;
  await addDoc(collection(db, 'users', user.uid, 'notifications'), {
    title, body, time, createdAt: Date.now()
  });
  await updateBellCount();
  const panel = document.getElementById('notificationsPanel');
  if (panel && !panel.classList.contains('hidden')) {
    await renderNotifications();
  }
};

// —————————————————————————————————————————
// 6) ربط الأحداث
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('notifBell')?.addEventListener('click', async () => {
    const panel = document.getElementById('notificationsPanel');
    panel.classList.toggle('hidden');
    await renderNotifications();
    await updateBellCount();
  });
  document.getElementById('clearNotifications')?.addEventListener('click', clearNotifications);
});

// —————————————————————————————————————————
// 7) متابعة وضع المستخدم وتأمين البدء
// —————————————————————————————————————————
onAuthStateChanged(auth, async user => {
  if (user) {
    // عند تسجيل الدخول:
    await updateBellCount();
    await renderNotifications();
  }
});
