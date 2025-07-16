import { initializeApp }   from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getFirestore,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:    "…",
  authDomain:"…",
  projectId: "…",
  // … بقية الإعدادات
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// دالةٌ لجلب آخر 50 إشعارًا من Firestore
export async function loadNotifications() {
  const col = collection(db, 'notifications');
  const q   = query(
    col,
    where('user', '==', window.currentUser),
    orderBy('time', 'desc'),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data());
}

// دوال العرض التي كانت عندك
function updateBellCount() {
  const count = JSON.parse(localStorage.getItem('notificationsLog') || '[]').length;
  const bell = document.getElementById('notifCount');
  if (!bell) return;
  bell.textContent = count;
  bell.style.display = count ? 'inline-block' : 'none';
}

export async function renderNotifications() {
  const notifs = await loadNotifications();
  const list   = document.getElementById('notificationsLog');
  const clearB = document.getElementById('clearNotifications');
  if (!list || !clearB) return;

  list.innerHTML = '';
  if (notifs.length === 0) {
    list.innerHTML = '<li>لا توجد إشعارات</li>';
    clearB.classList.add('hidden');
  } else {
    notifs.forEach(({ title, body, time }) => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${title}</strong><br>${body}<br><em>${new Date(time).toLocaleString()}</em>`;
      list.appendChild(li);
    });
    clearB.classList.toggle('hidden', window.currentUser !== '35190');
  }
  updateBellCount();
}

// عند التحميل
document.addEventListener('DOMContentLoaded', () => {
  updateBellCount();
  renderNotifications();
});
