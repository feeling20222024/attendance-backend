// push.js (معدّل) — modular Firebase v9
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js';
import { getMessaging, getToken, onMessage } from 'https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging.js';

const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';

const firebaseConfig = {
  apiKey:            "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:        "device-streaming-47cbe934.firebaseapp.com",
  projectId:         "device-streaming-47cbe934",
  storageBucket:     "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId:             "1:235398312189:web:8febe5e63f7b134b808e94"
};
const VAPID_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

// ----- مساعدات صغيرة -----
function safeJsonDecodeBase64(b64) {
  try {
    // استبدال URL-safe ثم decode
    b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(b64);
    return JSON.parse(json);
  } catch (e) { return null; }
}
function getUserCodeFromJwt(jwt) {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length < 2) return null;
  const payload = safeJsonDecodeBase64(parts[1]);
  return payload?.code ?? null;
}

// ---- تسجيل التوكن إلى السيرفر (آمن) ----
async function registerTokenWithServer(token) {
  const jwt = localStorage.getItem('jwtToken');
  if (!jwt) {
    console.log('registerTokenWithServer: no jwt — will register after login');
    return { ok: false, status: 'no-jwt' };
  }
  try {
    const res = await fetch(`${API_BASE}/register-token`, {
      method: 'POST',
      mode: 'cors',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwt}`
      },
      body: JSON.stringify({ token })
    });
    if (!res.ok) {
      console.warn('register-token responded', res.status);
      return { ok: false, status: res.status };
    }
    console.log('✅ token registered on server');
    // سجلنا أن هذا التوكن مُسجّل لصالح هذا المستخدم (بالمستخدم الموجود في الـ JWT)
    const code = getUserCodeFromJwt(jwt);
    if (code) localStorage.setItem('fcmTokenRegisteredFor', String(code));
    return { ok: true };
  } catch (err) {
    console.error('registerTokenWithServer error', err);
    return { ok: false, status: 'network' };
  }
}

// ----- initPush (مُحاط بحماية) -----
export async function initPush(swReg) {
  // حماية مزدوجة: منع تهيئة مكررة
  if (window.pushInitialized) {
    console.log('initPush: already initialized — skipping');
    return;
  }
  window.pushInitialized = true;

  // تهيئة Firebase فقط لو لم تُهيأ من قبل
  if (!getApps().length) {
    initializeApp(firebaseConfig);
  }

  const messaging = getMessaging();

  try {
    // اطلب الإذن إن لم يكن ممنوحاً (خيار جيد)
    if (Notification.permission !== 'granted') {
      try { await Notification.requestPermission(); } catch(e){ /* ignore */ }
    }

    // اطلب التوكن من FCM
    const fcmToken = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: swReg
    });

    console.log('✅ FCM token:', fcmToken);
    // خزّن محلياً دائماً (نستخدمه لاحقاً إذا لزم)
    localStorage.setItem('fcmToken', fcmToken);

    // سجل التوكن بالسيرفر إن كان عندنا jwt ولم يُسجّل لهذا المستخدم بعد
    const jwt = localStorage.getItem('jwtToken');
    const code = getUserCodeFromJwt(jwt);
    const registeredFor = localStorage.getItem('fcmTokenRegisteredFor');

    if (jwt && registeredFor !== String(code)) {
      const result = await registerTokenWithServer(fcmToken);
      if (!result.ok) {
        console.warn('initPush: registerTokenWithServer failed ->', result.status);
        // لا نغيّر window.pushInitialized هنا؛ سنحاول تسجيل لاحقًا
      }
    } else {
      if (!jwt) {
        console.log('initPush: obtained token but no JWT yet — will register after login');
      } else {
        console.log('initPush: token already registered for this user');
      }
    }

    // ----- استقبال رسائل الواجهة (foreground) -----
    // تجنّب ظهور نفس الاشعار عدة مرات بسرعة
    onMessage(messaging, payload => {
      const { title = '', body = '' } = payload.notification || {};
      const now = Date.now();
      const key = `${title}|${body}`;

      if (window._lastNotifKey === key && (now - (window._lastNotifTime || 0) < 3000)) {
        console.log('Duplicate foreground message ignored');
        return;
      }
      window._lastNotifKey = key;
      window._lastNotifTime = now;

      // عرض إشعار نظامي في الواجهة (للفوري)
      if (Notification.permission === 'granted') {
        try { new Notification(title, { body }); } catch(e){ console.warn('Notification failed', e); }
      }

      // إضافة للسجل المحلي (واجهة)
      window.addNotification?.({
        title,
        body,
        timestamp: now
      });
    });

    // انتهى init
    return fcmToken;

  } catch (err) {
    console.error('❌ initPush failed:', err);
    // لو فشل، نسمح بمحاولة لاحقة
    window.pushInitialized = false;
    throw err;
  }
}

// دالة مساعدة: بعد تسجيل الدخول يمكنك استدعاؤها للتأكد من أن التوكن مُسجَّل لصالح هذا المستخدم
window.registerFcmTokenForCurrentUser = async function() {
  const token = localStorage.getItem('fcmToken');
  if (!token) {
    console.log('No fcm token found locally');
    return;
  }
  const jwt = localStorage.getItem('jwtToken');
  if (!jwt) {
    console.log('No jwt — cannot register token now');
    return;
  }
  const code = getUserCodeFromJwt(jwt);
  const registeredFor = localStorage.getItem('fcmTokenRegisteredFor');
  if (registeredFor === String(code)) {
    console.log('Token already registered for this user');
    return;
  }
  await registerTokenWithServer(token);
};

// كشف الخلل: تعيين الريبّيتر للواجهة
window.initPush = initPush;
