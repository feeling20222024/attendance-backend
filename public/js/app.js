// —————————————————————————————————————————
// إعداد نقاط النهاية والمتغيرات العامة
// —————————————————————————————————————————
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
  '3': "خروج مبكر أو عدم مهر البصمة مساءً",
  '4': "عدد مرات التأخر أقل من ساعة (حسم يوم كل 3 تأخيرات)",
  '5': "تجميع ساعات (كل ثماني ساعات يُحتسب يوم)"
};

// —————————————————————————————————————————
// Helper: تطبيع أرقام عربية → غربية
// —————————————————————————————————————————
function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

// —————————————————————————————————————————
// إشعارات الويب (push.js)
// —————————————————————————————————————————
window.initPush = () => {
  if (!('Notification' in window)) return;
  Notification.requestPermission().then(p => {
    if (p === 'granted') console.log('📢 إشعارات الويب مفعلة');
  });
};

// —————————————————————————————————————————
// عند تحميل المحتوى: ربط الأزرار واسترجاع الجلسة
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('loginBtn').onclick  = login;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('aboutBtn').onclick  = () =>
    alert('فكرة وتصميم عمر عوني الماضي – دائرة الموارد البشرية – اتصالات دمشق');
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

// —————————————————————————————————————————
// 1) دالة تسجيل الدخول
// —————————————————————————————————————————
async function login() {
  const code = normalizeDigits(
    document.getElementById('codeInput').value.trim()
  );
  const pass = document.getElementById('passwordInput').value.trim();
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
      throw new Error(`خطأ بالخادم (${res.status})`);
    }

    const { token, user } = await res.json();
    jwtToken = token;
    localStorage.setItem('jwtToken', token);

    currentUser = user.code ?? user['كود الموظف'];
    window.currentUser = currentUser; // لتصل إلى push.js
    console.log('✅ login successful, currentUser =', currentUser);

    // تهيئة الإشعارات حسب المنصة
    if (window.Capacitor && Capacitor.getPlatform() !== 'web') {
      await initNativePush();
    } else {
      window.initPush();
    }

    // جلب وعرض البيانات
    await fetchAndRender();

  } catch (e) {
    console.error('❌ login error:', e);
    alert('حدث خطأ أثناء تسجيل الدخول');
  }
}

// —————————————————————————————————————————
// 2) تهيئة إشعارات Native (Android/iOS) عبر Capacitor
// —————————————————————————————————————————
async function initNativePush() {
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') {
      return console.warn('لم يتم منح إذن إشعارات الجوال');
    }

    await PushNotifications.register();
    PushNotifications.addListener('registration', async t => {
      console.log('✅ FCM mobile token:', t.value);
      await fetch(`${API_BASE}/register-token`, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ user: currentUser, token: t.value })
      });
    });
    PushNotifications.addListener('pushNotificationReceived', n => console.log('📩', n));
    PushNotifications.addListener('pushNotificationActionPerformed', a => console.log('📲', a));

  } catch (e) {
    console.warn('❌ initNativePush error:', e);
  }
}

// —————————————————————————————————————————
// 3) جلب وعرض البيانات (attendance + hwafez + me)
// —————————————————————————————————————————
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

  const aJson  = await aRes.json();
  const hwJson = await hwRes.json();
  const meJson = await meRes.json();

  headersAtt      = aJson.headers;     attendanceData = aJson.data;
  headersHw       = hwJson.headers;    hwafezData     = hwJson.data;
  currentUser     = meJson.user.code ?? meJson.user['كود الموظف'];

  // إظهار الواجهة وإخفاء نموذج الدخول
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('records').classList.remove('hidden');
  document.getElementById('welcomeMsg').textContent = `مرحباً ${currentUser}`;

  if (currentUser === SUPERVISOR_CODE) {
    document.getElementById('pushSection').classList.remove('hidden');
    document.getElementById('sendPushBtn').onclick = sendSupervisorNotification;
  }

  renderRecords();
}

// —————————————————————————————————————————
// 4) عرض سجلات الحضور
// —————————————————————————————————————————
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

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border px-4 py-2">${r[idx.code]||''}</td>
      <td class="border px-4 py-2">${r[idx.name]||''}</td>
      <td class="border px-4 py-2">${
        caseMapping[String(r[idx.status]).trim()]||''
      }</td>
      <td class="border px-4 py-2">${r[idx.date]||''}</td>
      <td class="border px-4 py-2">${r[idx.in]||''}</td>
      <td class="border px-4 py-2">${r[idx.out]||''}</td>
      <td class="border px-4 py-2">${r[idx.notes]||''}</td>
    `;
    tbody.appendChild(tr);
  });
}

// —————————————————————————————————————————
// 5) عرض بيانات الحوافز
// —————————————————————————————————————————
async function showHwafez() {
  try {
    const res = await fetch(`${API_BASE}/hwafez`, {
      headers:{
        'Content-Type':'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    if (!res.ok) throw new Error('فشل جلب بيانات الحوافز');

    const { headers, data } = await res.json();
    headersHw  = headers; hwafezData = data;

    document.getElementById('hwafezSection').classList.remove('hidden');
    const tbody = document.getElementById('hwafezBody');
    tbody.innerHTML = '';
    data.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="border px-4 py-2">${r[headers.indexOf('رقم الموظف')]||''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('الاسم')]||''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('حجم العمل')]||''}</td>
      `;
      tbody.appendChild(tr);
    });

    document.getElementById('noHwafezMsg')
      .classList.toggle('hidden', hwafezData.length > 0);
    document.getElementById('hwafezSection')
      .scrollIntoView({ behavior: 'smooth' });

  } catch (e) {
    console.error('❌ showHwafez error:', e);
    alert('حدث خطأ أثناء جلب بيانات الحوافز');
  }
}

// —————————————————————————————————————————
// 6) إرسال إشعار للمشرف
// —————————————————————————————————————————
async function sendSupervisorNotification() {
  const title = document.getElementById('notifTitleInput').value.trim();
  const body  = document.getElementById('notifBodyInput').value.trim();
  if (!title || !body) {
    return alert('يرجى إدخال عنوان ونص الإشعار.');
  }
  try {
    const res = await fetch(`${API_BASE}/notify-all`, {
      method: 'POST',
      headers:{
        'Content-Type':'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ title, body })
    });
    if (!res.ok) throw new Error(await res.text());
    alert('✅ تم إرسال الإشعار لجميع المستخدمين.');
    document.getElementById('notifTitleInput').value = '';
    document.getElementById('notifBodyInput').value  = '';
  } catch (err) {
    console.error('❌ sendSupervisorNotification error:', err);
    alert('❌ خطأ في إرسال الإشعار: ' + err.message);
  }
}

// —————————————————————————————————————————
// 7) تسجيل الخروج
// —————————————————————————————————————————
function logout() {
  currentUser = null;
  jwtToken    = null;
  localStorage.removeItem('jwtToken');
  document.getElementById('records').classList.add('hidden');
  document.getElementById('pushSection').classList.add('hidden');
  document.getElementById('loginSection').classList.remove('hidden');
}
