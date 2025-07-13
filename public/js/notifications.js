// —————————————————————————————————————————
// استيراد Modular Firebase API
// —————————————————————————————————————————
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

// —————————————————————————————————————————
// 1) تهيئة Firebase + Firestore
// —————————————————————————————————————————
const firebaseConfig = {
  apiKey:    "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:"device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket: "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:     "1:235398312189:web:8febe5e63f7b134b808e94"
};
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// —————————————————————————————————————————
// 2) دوال Firestore: إضافة وجلب الإشعارات
// —————————————————————————————————————————
export async function fetchNotifications(userId) {
  const col = collection(db, 'notifications', userId, 'log');
  const q   = query(col, orderBy('time', 'desc'), limit(50));
  const snap= await getDocs(q);
  return snap.docs.map(d => ({ id:d.id, ...d.data() }));
}

export async function pushNotificationToStore(userId, {title,body,time}) {
  const col = collection(db, 'notifications', userId, 'log');
  await addDoc(col, { title, body, time });
}

// —————————————————————————————————————————
// 3) دوال العرض المحلية (DOM + localStorage cache)
// —————————————————————————————————————————
const STORAGE_KEY = 'notificationsLog';
export function loadLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
export function saveLocal(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

export function renderNotifications() {
  const list = document.getElementById('notificationsLog');
  const clear= document.getElementById('clearNotifications');
  const arr  = loadLocal();
  if (!list||!clear) return;
  list.innerHTML = arr.length
    ? arr.map(n=>`
        <li class="mb-2 border-b pb-2">
          <div class="font-semibold">${n.title}</div>
          <div class="text-sm">${n.body}</div>
          <div class="text-xs text-gray-500">${n.time}</div>
        </li>`).join('')
    : `<li class="text-gray-500">لا توجد إشعارات</li>`;
  clear.style.display = (arr.length && window.currentUser==='35190')? 'block':'none';
}

export async function initNotificationsUI(userId) {
  // 1) جلب من Firestore
  const remote = await fetchNotifications(userId);
  saveLocal(remote);
  renderNotifications();
}

export function addNotificationUI({ title, body, time }) {
  const arr = loadLocal();
  arr.unshift({ title, body, time });
  if (arr.length>50) arr.pop();
  saveLocal(arr);
  renderNotifications();
}
