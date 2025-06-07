// js/app.js
import { PushNotifications } from '@capacitor/push-notifications';

const API_BASE       = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT = `${API_BASE}/login`;
const SUPERVISOR_CODE= '35190';

let jwtToken = null;
let currentUser = null;
// ... (بقية المتغيّرات والـ caseMapping)

document.addEventListener('DOMContentLoaded', () => {
  // 1) ربط الأزرار
  document.getElementById('loginBtn').onclick  = login;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('aboutBtn').onclick  = () => alert('...');
  document.getElementById('hwafezBtn').onclick = showHwafez;

  // 2) تهيئة Push Notifications
  PushNotifications.requestPermissions().then(result => {
    if (result.receive === 'granted') {
      PushNotifications.register();
    }
  });

  PushNotifications.addListener('registration', token => {
    console.log('✅ FCM Token:', token.value);
    // إرسال التوكن إلى API إذا أردت:
    // fetch(`${API_BASE}/register-token`, { method:'POST', body:JSON.stringify({ user:currentUser, token:token.value }) });
  });

  PushNotifications.addListener('registrationError', err => {
    console.error('❌ FCM Registration Error:', err);
  });
  PushNotifications.addListener('pushNotificationReceived', notification => {
    console.log('📩 Push Received:', notification);
  });
  PushNotifications.addListener('pushNotificationActionPerformed', action => {
    console.log('📲 Notification tapped:', action);
  });
});

// مثال للدالة login (كاملة)
async function login() {
  const code = document.getElementById('codeInput').value.trim();
  const pass = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) return alert('يرجى الإدخال');
  
  try {
    const res = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ code, pass })
    });
    if (!res.ok) {
      if (res.status === 401) return alert('بيانات دخول خاطئة');
      throw new Error('خطأ بالخادم');
    }
    const { token, user } = await res.json();
    jwtToken    = token;
    currentUser = user.code;
    localStorage.setItem('jwtToken', token);

    // استدعاء Push بعد نجاح تسجيل الدخول (اختياري)
    // إذا أردت إرسال التوكن المحصل عليه بعد login
    // PushNotifications.register();

    // ثم جلب البيانات وعرضها
    await fetchAndRender();
  } catch (e) {
    console.error(e);
    alert('فشل تسجيل الدخول');
  }
}

// باقي الدوال fetchAndRender، renderRecords، logout، showHwafez، sendSupervisorNotification
// كما كانت لديك سابقاً...
