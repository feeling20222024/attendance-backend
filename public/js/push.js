// public/js/push.js
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging.js';

const firebaseConfig = { /* as above */ };
if (!getApps().length) initializeApp(firebaseConfig);
const messaging = getMessaging();

export async function initPush() {
  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  } catch(e){
    console.warn('SW reg failed',e);
    return;
  }
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return;
  const reg = await navigator.serviceWorker.getRegistration();
  const token = await getToken(messaging,{
    vapidKey: VAPID_PUBLIC_KEY,
    serviceWorkerRegistration: reg
  });
  if (token && window.currentUser) {
    await fetch(`${API_BASE}/register-token`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ user: window.currentUser, token })
    });
  }
  onMessage(messaging,payload=>{
    const { title, body } = payload.notification || {};
    if (title && body) {
      new Notification(title,{ body });
      addNotification({ title, body, time: Date.now() });
    }
  });
}
