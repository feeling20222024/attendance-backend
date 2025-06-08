// public/js/app.js

// لا تضع import في السكريبتات العادية؛ سنستخدم import() داخل الدالة
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT  = `${API_BASE}/login`;
const SUPERVISOR_CODE = '35190';

let jwtToken    = null;
let currentUser = null;
let headersAtt, attendanceData;
let headersHw, hwafezData;

const caseMapping = {
  '1': "غياب غير مبرر (بدون إذن رسمي)",
  '2': "تأخر أكثر من ساعة أو عدم مهر البصمة صباحاً",
  '3': "خروج مبكر (أو عدم مهر البصمة مساءً)",
  '4': "عدد مرات التأخر أقل من ساعة (حسم يوم كل 3 تأخيرات)",
  '5': "تجميع ساعيات (كل ثماني ساعات يتم احتساب يوم)"
};

function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('loginBtn').onclick  = login;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('aboutBtn').onclick  = () => alert('…');
  document.getElementById('hwafezBtn').onclick = showHwafez;

  // إذا وجدنا توكن في localStorage، نحاول جلب البيانات
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
  const code = normalizeDigits(document.getElementById('codeInput').value.trim());
  const pass = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) return alert('يرجى إدخال الكود وكلمة المرور.');

  try {
    const res = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ code, pass })
    });
    if (res.status === 401) return alert('بيانات الدخول خاطئة');
    if (!res.ok) throw new Error(`خطأ تسجيل دخول (${res.status})`);

    const { token, user } = await res.json();
    jwtToken    = token;
    currentUser = user.code ?? user['كود الموظف'];
    localStorage.setItem('jwtToken', token);
    console.log('✅ login:', currentUser);

    // تهيئة الإشعارات
    if (window.Capacitor && Capacitor.getPlatform() !== 'web') {
      await initNativePush();
    } else {
      initPush();  // من ملف push.js
    }

    await fetchAndRender();
  } catch (e) {
    console.error('❌ login error:', e);
    alert('حدث خطأ أثناء تسجيل الدخول');
  }
}

async function initNativePush() {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const { value: perm } = await PushNotifications.requestPermissions();
    if (perm !== 'granted') {
      console.warn('لم يتم منح إذن إشعارات الجوال');
      return;
    }
    await PushNotifications.register();

    PushNotifications.addListener('registration', token => {
      console.log('✅ FCM mobile token:', token.value);
      fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          'Authorization':`Bearer ${jwtToken}`
        },
        body: JSON.stringify({ user: currentUser, token: token.value })
      }).catch(console.warn);
    });

    PushNotifications.addListener('pushNotificationReceived', n => console.log('📩', n));
    PushNotifications.addListener('pushNotificationActionPerformed', a => console.log('📲', a));
  } catch (e) {
    console.warn('تعذّر تهيئة إشعارات الجوال:', e);
  }
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

  // إذا ردّ أحدهم 401 → جلسة منتهية → logout
  if ([aRes, hwRes, meRes].some(r => r.status === 401)) {
    console.warn('401 Unauthorized → إعادة تسجيل الخروج');
    return logout();
  }
  if (!aRes.ok || !hwRes.ok || !meRes.ok) {
    throw new Error('فشل جلب البيانات');
  }

  const aJson  = await aRes.json();
  const hwJson = await hwRes.json();
  const meJson = await meRes.json();

  headersAtt     = aJson.headers;     attendanceData = aJson.data;
  headersHw      = hwJson.headers;    hwafezData     = hwJson.data;
  currentUser    = meJson.user.code ?? meJson.user['كود الموظف'];

  // عرض الواجهة
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('records').classList.remove('hidden');
  document.getElementById('welcomeMsg').textContent = `مرحباً ${currentUser}`;

  if (currentUser === SUPERVISOR_CODE) {
    document.getElementById('pushSection').classList.remove('hidden');
    document.getElementById('sendPushBtn').onclick = sendSupervisorNotification;
  }

  renderRecords();
}

function renderRecords() {
  const idx = {
    code:   headersAtt.indexOf('رقم الموظف'),
    name:   headersAtt.indexOf('الاسم'),
    status: headersAtt.indexOf('الحالة'),
    date:   headersAtt.indexOf('التاريخ'),
    in:     headersAtt.indexOf('دخول'),
    out:    headersAtt.indexOf('خروج'),
    notes:  headersAtt.indexOf('ملاحظات'),
  };

  const rows = attendanceData.filter(r => String(r[idx.code]) === currentUser);
  const tbody = document.getElementById('attendanceBody');
  tbody.innerHTML = '';

  if (!rows.length) {
    return document.getElementById('noDataMsg').classList.remove('hidden');
  }
  document.getElementById('noDataMsg').classList.add('hidden');

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border px-4 py-2">${r[idx.code]||''}</td>
      <td class="border px-4 py-2">${r[idx.name]||''}</td>
      <td class="border px-4 py-2">${caseMapping[String(r[idx.status]).trim()]||''}</td>
      <td class="border px-4 py-2">${r[idx.date]||''}</td>
      <td class="border px-4 py-2">${r[idx.in]||''}</td>
      <td class="border px-4 py-2">${r[idx.out]||''}</td>
      <td class="border px-4 py-2">${r[idx.notes]||''}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function showHwafez() {
  const res = await fetch(`${API_BASE}/hwafez`, {
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${jwtToken}` }
  });
  if (!res.ok) return alert('فشل جلب بيانات الحوافز');
  const { headers: hh, data } = await res.json();
  headersHw  = hh; hwafezData = data;

  document.getElementById('hwafezSection').classList.remove('hidden');
  const tbody = document.getElementById('hwafezBody');
  tbody.innerHTML = '';
  data.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border px-4 py-2">${r[hh.indexOf('رقم الموظف')]||''}</td>
      <td class="border px-4 py-2">${r[hh.indexOf('الاسم')]||''}</td>
      <td class="border px-4 py-2">${r[hh.indexOf('حجم العمل')]||''}</td>
    `;
    tbody.appendChild(tr);
  });
  document.getElementById('noHwafezMsg').classList.toggle('hidden', data.length>0);
  document.getElementById('hwafezSection').scrollIntoView({ behavior: 'smooth' });
}

async function sendSupervisorNotification() {
  const title = document.getElementById('notifTitleInput').value.trim();
  const body  = document.getElementById('notifBodyInput').value.trim();
  if (!title || !body) return alert('يرجى إدخال عنوان ونص الإشعار.');

  const res = await fetch(`${API_BASE}/notify-all`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${jwtToken}` },
    body: JSON.stringify({ title, body })
  });
  if (!res.ok) return alert('فشل إرسال الإشعار');
  alert('✅ تم إرسال الإشعار');
  document.getElementById('notifTitleInput').value = '';
  document.getElementById('notifBodyInput').value  = '';
}

function logout() {
  jwtToken = null;
  currentUser = null;
  localStorage.removeItem('jwtToken');
  ['records','pushSection','hwafezSection'].forEach(id =>
    document.getElementById(id).classList.add('hidden')
  );
  document.getElementById('loginSection').classList.remove('hidden');
}
