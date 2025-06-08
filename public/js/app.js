// js/app.js

const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT  = `${API_BASE}/login`;
const SUPERVISOR_CODE = '35190';

let jwtToken    = null;
let currentUser = null;
let headersAtt, attendanceData;
let headersHw, hwafezData;

const caseMapping = {
  '1': "غياب غير مبرر (بدون إذن رسمي)",
  // ... الباقي كما هو ...
};

function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

// إشعارات الويب
window.initPush = () => {
  if (!("Notification" in window)) return;
  Notification.requestPermission().then(p => {
    if (p === "granted") console.log('📢 إشعارات الويب مفعلة');
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  // عرض فورم الدخول فورًا
  document.getElementById('loginSection').hidden = false;

  document.getElementById('loginBtn').onclick  = login;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('aboutBtn').onclick  = () =>
    alert('فكرة وإعداد وتصميم عمر عوني الماضي – دائرة الموارد البشرية – اتصالات دمشق');
  document.getElementById('hwafezBtn').onclick = showHwafez;

  const saved = localStorage.getItem('jwtToken');
  if (saved) {
    jwtToken = saved;
    try {
      await fetchAndRender();
    } catch {
      logout();
    }
  }
});

async function login() {
  const rawCode = document.getElementById('codeInput').value.trim();
  const code    = normalizeDigits(rawCode);
  const pass    = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) {
    return alert('يرجى إدخال الكود وكلمة المرور.');
  }

  try {
    const res = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ code, pass })
    });
    if (res.status === 401) {
      return alert('بيانات الدخول خاطئة');
    }
    if (!res.ok) {
      throw new Error(`فشل تسجيل الدخول (${res.status})`);
    }

    const { token, user } = await res.json();
    jwtToken = token;
    localStorage.setItem('jwtToken', token);

    // اضبط currentUser قبل initPush/initNativePush
    currentUser = user.code ?? user['كود الموظف'];
    window.currentUser = currentUser;
    localStorage.setItem('currentUser', currentUser);
    console.log('✅ login successful, currentUser =', currentUser);

    // تهيئة الإشعارات
    if (window.Capacitor && Capacitor.getPlatform() !== 'web') {
      await initNativePush();
    } else {
      window.initPush();
    }

    // عرض السجلات
    await fetchAndRender();
  } catch (e) {
    console.error('❌ login error:', e);
    alert('حدث خطأ أثناء تسجيل الدخول');
  }
}

async function initNativePush() {
  // ... كود تهيئة Native Push كما سبق ...
}

async function fetchAndRender() {
  if (!jwtToken) return;

  const headers = {
    'Content-Type':'application/json',
    'Authorization': `Bearer ${jwtToken}`
  };
  const [aRes, hwRes, meRes] = await Promise.all([
    fetch(`${API_BASE}/attendance`, { headers }),
    fetch(`${API_BASE}/hwafez`,      { headers }),
    fetch(`${API_BASE}/me`,          { headers })
  ]);
  if (!aRes.ok || !hwRes.ok || !meRes.ok) {
    throw new Error('Unauthorized');
  }

  // إخفاء فورم الدخول، وإظهار السجلات
  document.getElementById('loginSection').hidden = true;
  document.getElementById('records').hidden      = false;

  const aJson  = await aRes.json();
  const hwJson = await hwRes.json();
  const meJson = await meRes.json();

  headersAtt      = aJson.headers;     attendanceData = aJson.data;
  headersHw       = hwJson.headers;    hwafezData     = hwJson.data;
  currentUser     = meJson.user.code ?? meJson.user['كود الموظف'];

  document.getElementById('welcomeMsg').textContent = `مرحباً ${currentUser}`;
  if (currentUser === SUPERVISOR_CODE) {
    document.getElementById('pushSection').hidden = false;
    document.getElementById('sendPushBtn').onclick = sendSupervisorNotification;
  }

  renderRecords();
}

function renderRecords() { /* … */ }
async function showHwafez() { /* … */ }
async function sendSupervisorNotification() { /* … */ }
function logout() {
  jwtToken = null;
  currentUser = null;
  localStorage.removeItem('jwtToken');
  localStorage.removeItem('currentUser');
  document.getElementById('records').hidden      = true;
  document.getElementById('pushSection').hidden  = true;
  document.getElementById('loginSection').hidden = false;
}
