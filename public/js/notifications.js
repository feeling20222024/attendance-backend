//  == public/js/notifications.js ==
// 1) استيراد Modular API من Firebase
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

// 2) تهيئة Firebase & Firestore
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
const notifsCol = collection(db, 'notifications'); // موحّد لكل المستخدمين

// 3) تحميل آخر 50 إشعارًا من Firestore ثمّ عرضها
export async function loadAndRenderNotifications() {
  // 3.1 جلب
  const q       = query(notifsCol, orderBy('time', 'desc'), limit(50));
  const snap    = await getDocs(q);
  const notifs  = snap.docs.map(d => d.data());
  // 3.2 خزّن عرض مؤقت في localStorage (للعدّ السريع)
  localStorage.setItem('notificationsLog', JSON.stringify(notifs));
  // 3.3 حدّث الواجهة
  renderNotifications(notifs);
}

// 4) العرض في الـ DOM
function renderNotifications(notifs) {
  const list   = document.getElementById('notificationsLog');
  const clearB = document.getElementById('clearNotifications');
  list.innerHTML = '';
  if (!notifs.length) {
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
    clearB.classList.remove('hidden');
  }
  // حدّث العداد
  const count = notifs.length;
  const bellCount = document.getElementById('notifCount');
  bellCount.textContent = count;
  bellCount.style.display = count ? 'inline-block' : 'none';
}

// 5) إضافة إشعار جديد إلى Firestore
export async function addNotification({ title, body }) {
  const time = Date.now();
  await addDoc(notifsCol, { title, body, time });
  // أعد التحميل والعرض
  await loadAndRenderNotifications();
}

// 6) مسح الإشعارات (للمشرف فقط بافتراض user 35190)
export async function clearNotifications() {
  const notifs = JSON.parse(localStorage.getItem('notificationsLog')) || [];
  // احذف كل المستندات
  await Promise.all(notifs.map(n => deleteDoc(doc(db, 'notifications', n.id))));
  await loadAndRenderNotifications();
}

// 7) ربط الواجهة
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('notifBell').onclick = () => {
    document.getElementById('notificationsPanel').classList.toggle('hidden');
  };
  document.getElementById('clearNotifications')
          .addEventListener('click', clearNotifications);
  // عند التحميل: جلب وعرض
  loadAndRenderNotifications();
});
