// —————————————————————————————————————————
// 1) إعداد نقاط النهاية والمتغيرات العامة
// —————————————————————————————————————————

const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT  = `${API_BASE}/login`;
const SUPERVISOR_CODE = '35190';

let headersAtt      = [], attendanceData = [];
let headersHw       = [], hwafezData     = [];
let headersTq       = [], tqeemData      = [];
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
// —————————————————————————————————————————
// DOMContentLoaded: ربط الأزرار وجلب الإشعارات
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  // ربط الأزرار الأساسية
  document.getElementById('loginBtn').onclick  = login;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('aboutBtn').onclick  = () =>
    alert('فكرة وإعداد وتصميم عمر عونـي الماضي   دائرة الموارد البشرية – فرع اتصالات دمشق');
  document.getElementById('hwafezBtn').onclick = showHwafez;
  document.getElementById('tqeemBtn').onclick  = showTqeem;

  // إذا كان هناك JWT محفوظ، نُعيد تهيئة الجلسة وجلب البيانات والإشعارات
  const savedToken = localStorage.getItem('jwtToken');
  if (savedToken) {
    jwtToken = savedToken;
    fetchAndRender()
      .then(async () => {
        // 1) تهيئة إشعارات الويب (SW + FCM)
        if (typeof window.initNotifications === 'function') {
          await window.initNotifications();
        }
        // 2) جلب سجل الإشعارات من الخادم للعرض الأولي
        try {
          const res = await fetch(`${API_BASE}/notifications`, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${jwtToken}`
            }
          });
          if (res.ok) {
            const { data } = await res.json();
            // خزّنها في localStorage لعرضها فوراً
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            // حدّث العداد في الواجهة
            if (typeof window.updateBellCount === 'function') {
              window.updateBellCount();
            }
          } else {
            console.warn('❌ فشل جلب الإشعارات، status:', res.status);
          }
        } catch (e) {
          console.warn('❌ لم يتم جلب سجل الإشعارات من الخادم:', e);
        }
      })
      .catch(logout);
  }
});

// —————————————————————————————————————————
// ——————————————————————————————
// 2) دالة تسجيل الدخول
// —————————————————————————————————————————
async function login() {
  const code = normalizeDigits(
    document.getElementById('codeInput').value.trim()
  );
  const pass = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) {
    return alert('يرجى إدخال الكود وكلمة المرور.');
  }

  let loginResponse;
  try {
    // 1) طلب المصادقة
    const res = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, pass })
    });
    if (res.status === 401) {
      return alert('بيانات الدخول خاطئة');
    }
    if (!res.ok) {
      throw new Error(`خطأ بالخادم عند تسجيل الدخول (${res.status})`);
    }

    // 2) استلام التوكن
    loginResponse = await res.json();
    jwtToken = loginResponse.token;
    localStorage.setItem('jwtToken', jwtToken);
    // 3) currentUser وتهيئة الإشعارات
currentUser = loginResponse.user.code ?? loginResponse.user['كود الموظف'];
window.currentUser = currentUser;
console.log('✅ login successful, currentUser =', currentUser);

// ✅ تهيئة واجهة سجل الإشعارات بعد تسجيل الدخول
if (typeof window.initNotifications === 'function') {
  window.initNotifications();
}

    // 4) تهيئة Push
    console.log('🚀 calling initPush()…');
    if (window.Capacitor && Capacitor.getPlatform() !== 'web') {
      await initNativePush();
    } else {
      await initPush();
    }

    // 5) تهيئة لوحة الإشعارات
    if (typeof window.initNotifications === 'function') {
      window.initNotifications();
    }

    // 5.1) تسجيل FCM Token المعلق بعد أن صار currentUser معرفاً
    
if (window._pendingFCMToken) {
  try {
    await fetch(`${API_BASE}/register-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({
        user: window.currentUser,
        token: window._pendingFCMToken
      })
    });
    console.log('✅ Pending token registered after login');
    delete window._pendingFCMToken;
  } catch (e) {
    console.error('❌ Failed to register pending token:', e);
  }
}


       // 6) جلب وعرض البيانات
    await fetchAndRender();
  } catch (e) {
    console.error('❌ login error:', e);
    alert('حدث خطأ أثناء تسجيل الدخول: ' + e.message);
  }
}  // ← هذا يغلق async function login()


// —————————————————————————————————————————
// 3) جلب وعرض البيانات (attendance + hwafez + me)
// —————————————————————————————————————————
async function fetchAndRender() {
  if (!jwtToken) return;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  };
  const [aRes, hwRes, meRes] = await Promise.all([
    fetch(`${API_BASE}/attendance`, { headers }),
    fetch(`${API_BASE}/hwafez`,      { headers }),
    fetch(`${API_BASE}/me`,          { headers })
  ]);
  if (!aRes.ok || !hwRes.ok || !meRes.ok) throw new Error('Unauthorized');

  const aJson  = await aRes.json();
  const hwJson = await hwRes.json();
  const meJson = await meRes.json();

  headersAtt     = aJson.headers;     attendanceData = aJson.data;
  headersHw      = hwJson.headers;    hwafezData     = hwJson.data;
  currentUser    = meJson.user['كود الموظف'];

  // إظهار الواجهة بعد تسجيل الدخول
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('records').classList.remove('hidden');
  document.getElementById('welcomeMsg').textContent = `مرحباً ${currentUser}`;

  // إذا كان المشرف
  if (currentUser === SUPERVISOR_CODE) {
    document.getElementById('pushSection').classList.remove('hidden');
    document.getElementById('sendPushBtn').onclick = sendSupervisorNotification;
  }

  // ملاحظات المشرف
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
}

// —————————————————————————————————————————
// 4) رسم سجلات الحضور للمستخدم الحالي
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

  // إحصائيات
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
// 5) عرض بيانات الحوافز
// —————————————————————————————————————————
async function showHwafez() {
  try {
    const res = await fetch(`${API_BASE}/hwafez`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    if (!res.ok) throw new Error('فشل جلب بيانات الحوافز');
    const { headers, data } = await res.json();
    headersHw  = headers;
    hwafezData = data;

    // إظهار القسم وتفريغ الجدول
    document.getElementById('hwafezSection').classList.remove('hidden');
    const tbody = document.getElementById('hwafezBody');
    tbody.innerHTML = '';

    // إذا لا توجد بيانات
    if (data.length === 0) {
      document.getElementById('noHwafezMsg').classList.remove('hidden');
      return;
    }
    document.getElementById('noHwafezMsg').classList.add('hidden');

    // بناء الصفوف
    data.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="border px-4 py-2">${r[headers.indexOf('رقم الموظف')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('الاسم')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('حجم العمل')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('اتقان العمل وفعاليته')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('المهارات القيادية')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('مهارة الإدارة الذاتية')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('مهارات التواصل والتفاعل')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('المبادرة والتطوير الذاتي')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('الإستقلال والموثوقية')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('الإلتزام والمسؤولية')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('نسبة الدوام الفعلي')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('السويّة الوظيفيّة')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('مستوى التأهيل')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('سنوات الخبرة')] || ''}</td>
      `;
      tbody.appendChild(tr);
    });

    // تمرير الشاشة للقسم
    document.getElementById('hwafezSection')
            .scrollIntoView({ behavior: 'smooth' });

  } catch (e) {
    console.error('❌ showHwafez error:', e);
    alert('حدث خطأ أثناء جلب بيانات الحوافز');
  }
}  // ← غلق showHwafez()

// —————————————————————————————————————————
// 5.1) عرض بيانات التقييم السنوي
async function showTqeem() {
  try {
    const res = await fetch(`${API_BASE}/tqeem`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    if (!res.ok) {
      throw new Error(`فشل جلب بيانات التقييم السنوي (status: ${res.status})`);
    }
    const {
      headers,
      data
    } = await res.json();
    headersTq = headers;
    tqeemData = data;
    const section = document.getElementById('tqeemSection');
    section.classList.remove('hidden');
    const tbody = document.getElementById('tqeemBody');
    tbody.innerHTML = '';
    const noMsg = document.getElementById('noTqeemMsg');
    if (data.length === 0) {
      noMsg.classList.remove('hidden');
      section.scrollIntoView({
        behavior: 'smooth'
      });
      return;
    }
    noMsg.classList.add('hidden');
    data.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = 'divide-y divide-gray-100';
      tr.innerHTML = `
        <td class="border px-4 py-2">${r[headers.indexOf('رقم الموظف')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('الاسم')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('حجم العمل')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('اتقان العمل وفعاليته')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('المهارات القيادية')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('مهارة الإدارة الذاتية')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('مهارات التواصل والتفاعل')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('المبادرة والتطوير الذاتي')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('الاستقلال والموثوقية')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('الالتزام والمسؤولية')] || ''}</td>
      `;
      tbody.appendChild(tr);
    });
    section.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  } catch (e) {
    console.error('❌ showTqeem error:', e);
    alert('حدث خطأ غير متوقع أثناء جلب بيانات التقييم السنوي');
  }
}
// —————————————————————————————————————————
// 6) إرسال إشعار للمشرف
// —————————————————————————————————————————
async function sendSupervisorNotification() {
  try {
    const title = document.getElementById('notifTitleInput').value.trim();
    const body  = document.getElementById('notifBodyInput').value.trim();
    if (!title || !body) {
      alert('يرجى إدخال عنوان ونص الإشعار.');
      return;
    }
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
  jwtToken     = null;
  localStorage.removeItem('jwtToken');
  ['records','pushSection','hwafezSection'].forEach(id =>
    document.getElementById(id).classList.add('hidden')
  );
  document.getElementById('loginSection').classList.remove('hidden');
}
