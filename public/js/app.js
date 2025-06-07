// —————————————————————————————————————————
//  إعداد نقاط النهاية والمتغيرات العامة
// —————————————————————————————————————————
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT  = `${API_BASE}/login`;
const SUPERVISOR_CODE = '35190';

let headersAtt      = [], attendanceData = [];
let headersHw       = [], hwafezData     = [];
let currentUser     = null;
let jwtToken        = null;

const caseMapping = {
  '1': "غياب غير مبرر (بدون إذن رسمي)",
  '2': "تأخر أكثر من ساعة أو عدم مهر البصمة صباحاً",
  '3': "خروج مبكر (أو عدم مهر البصمة مساءً)",
  '4': "عدد مرات التأخر أقل من ساعة (حسم يوم كل 3 تأخيرات)",
  '5': "تجميع ساعيات (كل ثماني ساعات يتم احتساب يوم)"
};

// —————————————————————————————————————————
//  Helper: تطبيع أرقام عربية → غربية
// —————————————————————————————————————————
function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

// —————————————————————————————————————————
//  DOMContentLoaded: ربط الواجهة وتهيئة الإشعارات (push.js)
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  // ربط الأزرار
  document.getElementById('loginBtn').onclick  = login;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('aboutBtn').onclick  = () =>
    alert('فكرة وإعداد وتصميم عمر عوني الماضي – دائرة الموارد البشرية – اتصالات دمشق');
  document.getElementById('hwafezBtn').onclick = showHwafez;

  // إذا كان push.js (Service Worker) متوفر نهيّئه بعد تسجيل الدخول
  // لذا لا نستدعي initPush() هنا تلقائيًا
});

// —————————————————————————————————————————
//  1) دالة تسجيل الدخول
// —————————————————————————————————————————
async function login() {
  console.log('🔑 login() called');
  let code = normalizeDigits(document.getElementById('codeInput').value.trim());
  let pass = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) {
    alert('يرجى إدخال الكود وكلمة المرور.');
    return;
  }

  try {
    const res = await fetch(LOGIN_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code, pass })
    });
    console.log('🔄 login status:', res.status);
    const body = await res.clone().json().catch(()=>null);
    console.log('🔄 login response:', body);
    if (res.status === 401) {
      return alert('بيانات الدخول خاطئة');
    }
    if (!res.ok) {
      throw new Error(`خطأ بالخادم (${res.status})`);
    }

    const { token, user } = await res.json();
    if (!token || !user) {
      throw new Error('رد غير متوقع من السيرفر');
    }
    jwtToken = token;
    localStorage.setItem('jwtToken', token);

    // خزن currentUser من المفتاح الإنجليزي ثم السقوط للمفتاح العربي
    currentUser = user.code ?? user['كود الموظف'];
    window.currentUser = currentUser;

    console.log('🔑 login successful, currentUser =', currentUser);

    // استدعاء initPush من push.js إذا وجدت
    if (window.initPush) {
      console.log('🚀 calling initPush()...');
      initPush();
    }

    // الآن جلب وعرض البيانات
    await fetchAndRender();

  } catch (e) {
    console.error('❌ login error:', e);
    alert('حدث خطأ أثناء تسجيل الدخول');
  }
}

// —————————————————————————————————————————
//  2) جلب وعرض البيانات المحمية (attendance + hwafez + me)
// —————————————————————————————————————————
async function fetchAndRender() {
  if (!jwtToken) return;

  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${jwtToken}`
  };

  console.log('🚀 fetching protected data...');
  try {
    const [aRes, hwRes, meRes] = await Promise.all([
      fetch(`${API_BASE}/attendance`, { headers }),
      fetch(`${API_BASE}/hwafez`,      { headers }),
      fetch(`${API_BASE}/me`,          { headers })
    ]);

    if (!aRes.ok || !hwRes.ok || !meRes.ok) {
      throw new Error('فشل جلب البيانات (ربما انتهت صلاحية الجلسة)');
    }

    const aJson  = await aRes.json();
    const hwJson = await hwRes.json();
    const meJson = await meRes.json();
    console.log('🔄 /me response:', meJson);

    headersAtt     = aJson.headers;
    attendanceData = aJson.data;
    headersHw      = hwJson.headers;
    hwafezData     = hwJson.data;
    // تحديث currentUser أيضاً بناءً على المفتاح المناسب
    currentUser    = meJson.user.code ?? meJson.user['كود الموظف'];

    // إظهار الواجهة بعد تسجيل الدخول
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('records').classList.remove('hidden');
    document.getElementById('welcomeMsg').textContent = `مرحباً ${currentUser}`;

    // إذا كان مشرفاً، نظهر قسم الإشعارات
    if (currentUser === SUPERVISOR_CODE) {
      document.getElementById('pushSection').classList.remove('hidden');
      document.getElementById('sendPushBtn').onclick = sendSupervisorNotification;
    }

    // إعداد ملاحظات المشرف
    const notesArea = document.getElementById('supervisorNotes');
    const saveBtn   = document.getElementById('saveNotesBtn');
    notesArea.value = localStorage.getItem('supervisorNotes') || '';
    if (currentUser === SUPERVISOR_CODE) {
      notesArea.removeAttribute('readonly');
      saveBtn.classList.remove('hidden');
      saveBtn.onclick = () => {
        localStorage.setItem('supervisorNotes', notesArea.value);
        alert('تم حفظ الملاحظة');
      };
    } else {
      notesArea.setAttribute('readonly', '');
      saveBtn.classList.add('hidden');
    }

    renderRecords();

  } catch (e) {
    console.error('❌ fetchAndRender error:', e);
    logout();
  }
}

// —————————————————————————————————————————
//  3) دالة رسم سجلات الحضور
// —————————————————————————————————————————
function renderRecords() {
  const idx = {
    code:     headersAtt.indexOf('رقم الموظف'),
    name:     headersAtt.indexOf('الاسم'),
    status:   headersAtt.indexOf('الحالة'),
    date:     headersAtt.indexOf('التاريخ'),
    in:       headersAtt.indexOf('دخول'),
    out:      headersAtt.indexOf('خروج'),
    sFrom:    headersAtt.indexOf('ساعية (من الساعة)'),
    sTo:      headersAtt.indexOf('ساعية (إلى الساعة)'),
    mFrom:    headersAtt.indexOf('مهمة (من الساعة)'),
    mTo:      headersAtt.indexOf('مهمة (إلى الساعة)'),
    days:     headersAtt.indexOf('عدد الأيام المحتسبة بتقرير الساعيات أو التأخر أقل من ساعة'),
    notes:    headersAtt.indexOf('ملاحظات'),
    adminC:   headersAtt.indexOf('عدد الإجازات الإدارية المحتسبة للعامل'),
    adminR:   headersAtt.indexOf('عدد الإجازات الإدارية المتبقية للعامل'),
    adminDue: headersAtt.indexOf('عدد الإجازات الإدارية المستحقة للعامل'),
  };

  const rows = attendanceData.filter(r =>
    String(r[idx.code]).trim() === currentUser
  );
  const tbody = document.getElementById('attendanceBody');
  tbody.innerHTML = '';

  if (!rows.length) {
    document.getElementById('noDataMsg').classList.remove('hidden');
    return;
  }
  document.getElementById('noDataMsg').classList.add('hidden');

  const first = rows[0];
  document.getElementById('adminLeavesDue').textContent       = first[idx.adminDue]  || '--';
  document.getElementById('adminLeavesCounted').textContent   = first[idx.adminC]    || '--';
  document.getElementById('adminLeavesRemaining').textContent = first[idx.adminR]    || '--';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border px-4 py-2">${r[idx.code]||''}</td>
      <td class="border px-4 py-2">${r[idx.name]||''}</td>
      <td class="border px-4 py-2">${caseMapping[String(r[idx.status]).trim()]||''}</td>
      <td class="border px-4 py-2">${r[idx.date]||''}</td>
      <td class="border px-4 py-2">${r[idx.in]||''}</td>
      <td class="border px-4 py-2">${r[idx.out]||''}</td>
      <td class="border px-4 py-2">${r[idx.sFrom]||''}</td>
      <td class="border px-4 py-2">${r[idx.sTo]||''}</td>
      <td class="border px-4 py-2">${r[idx.mFrom]||''}</td>
      <td class="border px-4 py-2">${r[idx.mTo]||''}</td>
      <td class="border px-4 py-2">${r[idx.days]||''}</td>
      <td class="border px-4 py-2">${r[idx.notes]||''}</td>
    `;
    tbody.appendChild(tr);
  });
}

// —————————————————————————————————————————
//  4) دالة عرض بيانات الحوافز
// —————————————————————————————————————————
async function showHwafez() {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    };
    const res = await fetch(`${API_BASE}/hwafez`, { headers });
    if (!res.ok) throw new Error('فشل جلب بيانات الحوافز');

    const json = await res.json();
    headersHw  = json.headers;
    hwafezData = json.data;

    document.getElementById('hwafezSection').classList.remove('hidden');
    // … (رسم الجدول كما في السابق) …
    document.getElementById('hwafezSection').scrollIntoView({ behavior: 'smooth' });

  } catch (e) {
    console.error('❌ showHwafez error:', e);
    alert('حدث خطأ أثناء جلب بيانات الحوافز');
  }
}

// —————————————————————————————————————————
//  5) دالة إرسال إشعار للمشرف
// —————————————————————————————————————————
async function sendSupervisorNotification() {
  const title = document.getElementById('notifTitleInput').value.trim();
  const body  = document.getElementById('notifBodyInput').value.trim();
  if (!title || !body) {
    alert('يرجى إدخال عنوان ونص الإشعار.');
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/notify-all`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ title, body })
    });
    if (!res.ok) throw new Error(await res.text() || res.status);
    alert('✅ تم إرسال الإشعار لجميع المستخدمين.');
    document.getElementById('notifTitleInput').value = '';
    document.getElementById('notifBodyInput').value  = '';
  } catch (err) {
    console.error('❌ sendSupervisorNotification error:', err);
    alert('❌ خطأ في إرسال الإشعار: ' + err.message);
  }
}

// —————————————————————————————————————————
//  6) دالة تسجيل الخروج
// —————————————————————————————————————————
function logout() {
  currentUser = null;
  jwtToken    = null;
  localStorage.removeItem('jwtToken');

  ['records','pushSection','hwafezSection'].forEach(id =>
    document.getElementById(id).classList.add('hidden')
  );
  document.getElementById('loginSection').classList.remove('hidden');
}
