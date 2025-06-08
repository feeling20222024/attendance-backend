// —————————————————————————————————————————————————————————
//  ملف app.js (واجهة الويب) — بدون import ثابت لـ Capacitor!
// —————————————————————————————————————————————————————————

const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT  = `${API_BASE}/login`;
const SUPERVISOR_CODE = '35190';

let jwtToken       = null;
let currentUser    = null;
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

  // استعادة التوكن إذا كان محفوظًا
  const saved = localStorage.getItem('jwtToken');
  if (saved) {
    jwtToken = saved;
    try { await fetchAndRender(); }
    catch { logout(); }
  }
});

async function login() {
  const code = normalizeDigits(document.getElementById('codeInput').value.trim());
  const pass = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) return alert('يرجى الإدخال.');

  const res = await fetch(LOGIN_ENDPOINT, {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code,pass})
  });
  if (res.status===401) return alert('بيانات خاطئة');
  if (!res.ok) throw new Error('فشل تسجيل الدخول');

  const { token, user } = await res.json();
  jwtToken    = token;
  currentUser = user.code ?? user['كود الموظف'];
  localStorage.setItem('jwtToken', token);
  window.currentUser = currentUser;
  console.log('✅ login:', currentUser);

  // بعد تسجيل الدخول: طلب إذن إشعارات الويب
  window.initPush();

  await fetchAndRender();
}

async function fetchAndRender() {
  if (!jwtToken) return;

  const headers = {
    'Content-Type':'application/json',
    'Authorization':`Bearer ${jwtToken}`
  };
  const [aRes, hwRes, meRes] = await Promise.all([
    fetch(`${API_BASE}/attendance`, {headers}),
    fetch(`${API_BASE}/hwafez`,      {headers}),
    fetch(`${API_BASE}/me`,          {headers})
  ]);
  if (!aRes.ok||!hwRes.ok||!meRes.ok) throw new Error();

  const aJson  = await aRes.json();
  const hwJson = await hwRes.json();
  const meJson = await meRes.json();

  headersAtt     = aJson.headers;      attendanceData = aJson.data;
  headersHw      = hwJson.headers;     hwafezData     = hwJson.data;
  currentUser    = meJson.user.code ?? meJson.user['كود الموظف'];

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
      <td class="border px-4 py-2">${r[idx.code]}</td>
      <td class="border px-4 py-2">${r[idx.name]}</td>
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
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${jwtToken}`}
  });
  if (!res.ok) return alert('فشل جلب الحوافز');
  const { headers: hh, data } = await res.json();
  headersHw = hh; hwafezData = data;
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
  document.getElementById('hwafezSection').scrollIntoView({behavior:'smooth'});
}

async function sendSupervisorNotification() {
  const title = document.getElementById('notifTitleInput').value.trim();
  const body  = document.getElementById('notifBodyInput').value.trim();
  if(!title||!body) return alert('يرجى عنوان ونص');
  const res = await fetch(`${API_BASE}/notify-all`, {
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':`Bearer ${jwtToken}`},
    body: JSON.stringify({title,body})
  });
  if(!res.ok) return alert('فشل الإرسال');
  alert('✅ أُرسل الاشعار');
  document.getElementById('notifTitleInput').value='';
  document.getElementById('notifBodyInput').value='';
}

function logout() {
  jwtToken=null; currentUser=null;
  localStorage.removeItem('jwtToken');
  ['records','pushSection','hwafezSection'].forEach(id=>
    document.getElementById(id).classList.add('hidden')
  );
  document.getElementById('loginSection').classList.remove('hidden');
}
