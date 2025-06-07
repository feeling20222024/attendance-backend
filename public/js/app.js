import { PushNotifications } from '@capacitor/push-notifications';

// —————————————————————————————————————————
// 1) إعداد المتغيرات ونقطة النهاية
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
// Helper: تطبيع أرقام عربية → غربية
// —————————————————————————————————————————
function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

// —————————————————————————————————————————
// DOMContentLoaded: ربط الأزرار
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').onclick  = login;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('aboutBtn').onclick  = () =>
    alert('فكرة وإعداد وتصميم عمر عوني الماضي – دائرة الموارد البشرية – اتصالات دمشق');
  document.getElementById('hwafezBtn').onclick = showHwafez;
});

// —————————————————————————————————————————
// 2) تسجيل الدخول كما كان لديك
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
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, pass })
    });
    console.log('🔄 login status:', res.status);

    if (res.status === 401) {
      alert('بيانات الدخول خاطئة');
      return;
    }
    if (!res.ok) {
      throw new Error(`فشل تسجيل الدخول (رمز: ${res.status})`);
    }

    const { token, user } = await res.json();
    jwtToken    = token;
    currentUser = user.code ?? user['كود الموظف'];
    localStorage.setItem('jwtToken', jwtToken);

    console.log('🔑 login successful, currentUser =', currentUser);

    // بعد نجاح الدخول، نهيّئ إشعارات الـ Native
    initNativePush();

    // ثم جلب وعرض البيانات
    await fetchAndRender();

  } catch (e) {
    console.error('❌ login error:', e);
    alert('حدث خطأ أثناء تسجيل الدخول');
  }
}

// —————————————————————————————————————————
// 3) تهيئة إشعارات Native (Android/iOS)
// —————————————————————————————————————————
async function initNativePush() {
  try {
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') {
      console.warn('لم يُمنح الإذن للإشعارات على Native');
      return;
    }
    await PushNotifications.register();

    PushNotifications.addListener('registration', token => {
      console.log('✅ FCM Token (mobile):', token.value);
      // أرسل التوكن للخادم
      fetch(`${API_BASE}/register-token`, {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ user: currentUser, token: token.value })
      }).catch(e => console.warn('Failed to register token:', e));
    });

    PushNotifications.addListener('registrationError', err => {
      console.error('❌ RegistrationError (mobile):', err);
    });

    PushNotifications.addListener('pushNotificationReceived', notification => {
      console.log('📩 Push Received (mobile):', notification);
      // هنا يمكنك إظهار إشعار محلي أو تحديث الواجهة
    });

    PushNotifications.addListener('pushNotificationActionPerformed', action => {
      console.log('📲 Notification tapped (mobile):', action);
    });

  } catch (e) {
    console.warn('تعذّر تهيئة Native Push:', e);
  }
}

// —————————————————————————————————————————
// 4) جلب وعرض البيانات كما كان لديك
// —————————————————————————————————————————
async function fetchAndRender() {
  if (!jwtToken) return;
  console.log('🚀 fetching protected data...');

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  };

  try {
    const [aRes, hwRes, meRes] = await Promise.all([
      fetch(`${API_BASE}/attendance`, { headers }),
      fetch(`${API_BASE}/hwafez`,      { headers }),
      fetch(`${API_BASE}/me`,          { headers })
    ]);
    if (!aRes.ok || !hwRes.ok || !meRes.ok) throw new Error('فشل جلب البيانات');

    const aJson  = await aRes.json();
    const hwJson = await hwRes.json();
    const meJson = await meRes.json();
    console.log('🔄 /me response:', meJson);

    headersAtt      = aJson.headers;
    attendanceData  = aJson.data;
    headersHw       = hwJson.headers;
    hwafezData      = hwJson.data;
    currentUser     = meJson.user.code ?? meJson.user['كود الموظف'];

    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('records').classList.remove('hidden');
    document.getElementById('welcomeMsg').textContent = `مرحباً ${currentUser}`;

    if (currentUser === SUPERVISOR_CODE) {
      document.getElementById('pushSection').classList.remove('hidden');
      document.getElementById('sendPushBtn').onclick = sendSupervisorNotification;
    }

    renderRecords();
  } catch (e) {
    console.error('❌ fetchAndRender error:', e);
    logout();
  }
}

// —————————————————————————————————————————
// 5) رسم سجلات الحضور
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
// 6) عرض بيانات الحوافز
// —————————————————————————————————————————
async function showHwafez() {
  try {
    const res = await fetch(`${API_BASE}/hwafez`, {
      method:  'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    if (!res.ok) throw new Error('فشل جلب بيانات الحوافز'); 
    const { headers: h, data } = await res.json();
    headersHw  = h;
    hwafezData = data;

    document.getElementById('hwafezSection').classList.remove('hidden');
    // … أرسم الجدول كما كان …
    document.getElementById('hwafezSection').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    console.error('❌ showHwafez error:', e);
    alert('حدث خطأ أثناء جلب بيانات الحوافز');
  }
}

// —————————————————————————————————————————
// 7) إرسال إشعار للمشرف
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
// 8) تسجيل الخروج
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
