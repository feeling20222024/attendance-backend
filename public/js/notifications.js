// public/js/notifications.js
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getFirestore, collection, addDoc, getDocs, query, orderBy, limit } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';

// 0) Init Firebase once
const firebaseConfig = {
  apiKey:    "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:"device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket:"device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:      "1:235398312189:web:8febe5e63f7b134b808e94"
};
if (!getApps().length) initializeApp(firebaseConfig);
const db = getFirestore();

// storage key for quick local UI update:
const STORAGE_KEY = 'notificationsLog';

// load last 50 from Firestore
export async function loadNotifications() {
  const col = collection(db, 'notifications', window.currentUser, 'log');
  const q   = query(col, orderBy('time', 'desc'), limit(50));
  const snap= await getDocs(q);
  const arr = snap.docs.map(d => d.data());
  // also save locally
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  return arr;
}

// render count
export function updateBellCount() {
  const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const n = stored.length;
  const el= document.getElementById('notifCount');
  if (!el) return;
  el.textContent = n;
  el.style.display = n>0?'inline-block':'none';
}

// render panel
export function renderNotifications() {
  const list = document.getElementById('notificationsLog');
  const arr  = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  if (!list) return;
  list.innerHTML = arr.length
    ? arr.map(n=>`<li class="mb-2 border-b pb-2">
        <div class="font-semibold">${n.title}</div>
        <div class="text-sm">${n.body}</div>
        <div class="text-xs text-gray-400">${new Date(n.time).toLocaleString()}</div>
      </li>`).join('')
    : '<li class="text-gray-500">لا توجد إشعارات</li>';
}

// add new notification (both local & Firestore)
export async function addNotification(payload) {
  // local
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  saved.unshift({ ...payload });
  if (saved.length>50) saved.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  renderNotifications();
  updateBellCount();

  // Firestore
  await addDoc(collection(db,'notifications',window.currentUser,'log'), {
    title: payload.title,
    body:  payload.body,
    time:  payload.time
  });
}

// wire up bell button
document.addEventListener('DOMContentLoaded',()=>{
  const bell = document.getElementById('notifBell');
  const panel= document.getElementById('notificationsPanel');
  bell?.addEventListener('click',()=>{
    panel.classList.toggle('hidden');
    renderNotifications();
    updateBellCount();
  });
  // init UI
  renderNotifications();
  updateBellCount();
});
