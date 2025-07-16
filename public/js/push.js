import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js';
import {
  getMessaging,
  getToken,
  onMessage
} from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js';

const firebaseConfig = { /* كما في الأعلى */ };
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const messaging = getMessaging(app);

const API_BASE       = 'https://dwam-app-by-omar.onrender.com/api';
const VAPID_PUBLIC_KEY = '…';

// دالة لإضافة إشعار في Firestore
async function saveToFirestore({ title, body, time }) {
  if (!window.currentUser) return;
  await addDoc(collection(db, 'notifications'), {
    user:  window.currentUser,
    title, body, time
  });
}

// دالة initPush للويب
export async function initPush() {
  // 1) سجّل SW
  await navigator.serviceWorker.register('/firebase-messaging-sw.js').catch(console.warn);
  // 2) احصل على صلاحية وToken
  if (await Notification.requestPermission() !== 'granted') return;
  const reg   = await navigator.serviceWorker.getRegistration();
  const token = await getToken(messaging, { vapidKey: VAPID_PUBLIC_KEY, serviceWorkerRegistration: reg })
    .catch(console.warn);
  if (token && window.currentUser) {
    // بعث التوكن للسيرفر (لـ server-side notifications)
    fetch(`${API_BASE}/register-token`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ user: window.currentUser, token })
    }).catch(console.warn);
  }
  // 3) استمع للرسائل الواردة في المقدمة
  onMessage(messaging, payload => {
    const { title, body } = payload.notification || {};
    const now = Date.now();
    if (title && body) {
      new Notification(title, { body });
      saveToFirestore({ title, body, time: now });
      window.renderNotifications();
    }
  });
}
