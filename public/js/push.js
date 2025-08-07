import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js';

const API_BASE       = 'https://dwam-app-by-omar.onrender.com/api';
const firebaseConfig = {
  apiKey:            "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:        "device-streaming-47cbe934.firebaseapp.com",
  projectId:         "device-streaming-47cbe934",
  storageBucket:     "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId:             "1:235398312189:web:8febe5e63f7b134b808e94"
};
const VAPID_KEY      = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

export async function initPush(swReg) {
  const app       = initializeApp(firebaseConfig);
  const messaging = getMessaging(app);

  try {
    const fcmToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });
    console.log('✅ FCM token:', fcmToken);

    if (localStorage.getItem('fcmTokenSent') !== fcmToken) {
      await fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        mode:   'cors',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${localStorage.getItem('jwtToken')}`
        },
        body: JSON.stringify({ token: fcmToken })
      });
      localStorage.setItem('fcmTokenSent', fcmToken);
    }

    // رسائل الواجهة الحيّة
    onMessage(messaging, payload => {
      const { title='', body='' } = payload.notification||{};
      if (Notification.permission==='granted') {
        new Notification(title, { body });
      }
      window.addNotification?.({
        title, body,
        time: new Date().toLocaleString()
      });
    });

  } catch(err){
    console.error('❌ initPush failed:', err);
  }
}

window.initPush = initPush;
