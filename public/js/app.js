// 1) إعداد نقاط النهاية والمتغيرات العامة
const API_BASE       = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT = `${API_BASE}/login`;
const SUPERVISOR_CODE= '35190';
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
// DOMContentLoaded: ربط الأزرار
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').onclick  = login;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('aboutBtn').onclick  = () =>
    alert('فكرة وإعداد وتصميم عمر عونـي الماضي   دائرة الموارد البشرية – فرع اتصالات دمشق');
  document.getElementById('hwafezBtn').onclick = showHwafez;
  document.getElementById('tqeemBtn').onclick  = showTqeem;

  const saved = localStorage.getItem('jwtToken');
  if (saved) {
    jwtToken = saved;
    fetchAndRender()
      .then(() => {
        if (typeof window.initNotifications === 'function') {
          window.initNotifications();
        }
      })
      .catch(logout);
  }
});

// —————————————————————————————————————————
// تسجيل الـ Service Worker وتهيئة إشعارات Push
// —————————————————————————————————————————
async function registerSWand() {
  if ('serviceWorker' in navigator) {
    try {
      // هذا هو المسار الذي استخدمناه في public/
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('✅ FCM SW registered with scope:', reg.scope);

      // مرّر الـ registration إلى 
      await window.(reg);
    } catch (e) {
      console.error('❌ SW registration failed:', e);
    }
  }
}

// —————————————————————————————————————————
// 2) دالة تسجيل الدخول
// —————————————————————————————————————————
// 2) دالة تسجيل الدخول
async function login() {
  const code = normalizeDigits(
    document.getElementById('codeInput').value.trim()
  );
  const pass = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) {
    return alert('يرجى إدخال الكود وكلمة المرور.');
  }

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
    const loginResponse = await res.json();
    jwtToken = loginResponse.token;
    localStorage.setItem('jwtToken', jwtToken);

    // 3) currentUser
    currentUser = loginResponse.user.code ?? loginResponse.user['كود الموظف'];
    window.currentUser = currentUser;
    console.log('✅ login successful, currentUser =', currentUser);

    // 4) تسجيل الـ SW وتهيئة Push Notifications
    console.log('🚀 Registering Service Worker and initializing Push Notifications...');
    if ('serviceWorker' in navigator) {
      try {
        // سجّل Service Worker الخاص بالـ FCM
        const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('✅ FCM SW registered with scope:', swReg.scope);
        // مرّر الـ registration إلى دالة initPush
        await window.initPush(swReg);
      } catch (err) {
        console.error('❌ Service Worker registration or initPush failed:', err);
      }
    } else {
      console.warn('⚠️ Service Worker not supported');
    }

    // 5) تهيئة لوحة الإشعارات (إن وجدت)
    if (typeof window.initNotifications === 'function') {
      window.initNotifications();
    }

    // 6) جلب وعرض البيانات
    await fetchAndRender();

  } catch (e) {
    console.error('❌ login error:', e);
    alert('حدث خطأ أثناء تسجيل الدخول: ' + e.message);
  }
}


// (تابع باقي الدوال كما لديك بدون تغيير...)

// مثال دالة fetchAndRender()، showHwafez()، showTqeem()، logout() ... 

// تأكد أن باقي دوالك تعمل كما هي

// —————————————————————————————————————————
// 3) جلب وعرض البيانات (attendance + hwafez + me)
// —————————————————————————————————————————
async function fetchAndRender() {
  if (!jwtToken) return;

  const headersReq = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  };

  try {
    // جلب البيانات من نقطتي النهاية فقط
    const [aRes, hwRes] = await Promise.all([
      fetch(`${API_BASE}/attendance`, { headers: headersReq }),
      fetch(`${API_BASE}/hwafez`,      { headers: headersReq })
    ]);

    // التحقق من نجاح الاستجابات
    if (!aRes.ok) throw new Error(`خطأ في جلب الحضور: ${aRes.status}`);
    if (!hwRes.ok) throw new Error(`خطأ في جلب الحوافز: ${hwRes.status}`);

    // التحقق من كون الرد JSON
    function assertJson(res, name) {
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        throw new Error(`نوع المحتوى غير متوقع في ${name}: ${ct}`);
      }
    }
    assertJson(aRes, 'attendance');
    assertJson(hwRes, 'hwafez');

    // فك JSON
    const aJson  = await aRes.json();
    const hwJson = await hwRes.json();

    // تعيين المتغيرات العالمية
    headersAtt     = aJson.headers;
    attendanceData = aJson.data;
    const generalNote = aJson.generalNote || '';
    headersHw      = hwJson.headers;
    hwafezData     = hwJson.data;

    // عرض الملاحظة العامة
    if (generalNote) {
      const generalBox  = document.getElementById('generalNoteBox');
      const generalText = document.getElementById('generalNoteText');
      if (generalBox && generalText) {
        generalText.textContent = generalNote;
        generalBox.classList.remove('hidden');
      }
    }

    // عرض الملاحظة الثابتة للجميع
    const idxPriv = headersAtt.indexOf("تنبيهات وملاحظات عامة");
    if (idxPriv !== -1 && attendanceData.length > 0) {
      const privateNote = attendanceData[0][idxPriv] || '';
      const noteBox = document.getElementById('supervisorNotes');
      if (noteBox) noteBox.textContent = privateNote.trim();
    }

    // تحديث الواجهة
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('records').classList.remove('hidden');
    document.getElementById('welcomeMsg')
            .textContent = `مرحباً ${currentUser}`;

    if (currentUser === SUPERVISOR_CODE) {
      const pushSection = document.getElementById('pushSection');
      const sendBtn     = document.getElementById('sendPushBtn');
      if (pushSection) pushSection.classList.remove('hidden');
      if (sendBtn)     sendBtn.onclick = sendSupervisorNotification;
    }

    renderRecords();

  } catch (err) {
    console.error('❌ fetchAndRender error:', err);
    alert('حدث خطأ أثناء جلب البيانات: ' + err.message);
    logout();
  }
}


// —————————————————————————————————————————
// 4) رسم سجلات الحضور للمستخدم الحالي
// —————————————————————————————————————————
function renderRecords() {
  const idx = {
    code:     headersAtt.indexOf('رقم الموظف'),
    name:     headersAtt.indexOf('الاسم'),
    status:   headersAtt.indexOf('الحالة'),
    day:      headersAtt.indexOf('اليوم'),
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

  // 1) كل الصفوف الخاصة بالمستخدم (بلا تصفية)
  const allRows = attendanceData.filter(r =>
    String(r[idx.code]).trim() === currentUser
  );

  // 2) إذا لدينا أي صفوف، نستخدم أول صف للإحصائيات
  if (allRows.length) {
    const firstRow = allRows[0];
    document.getElementById('adminLeavesDue').textContent       = firstRow[idx.adminDue]   || '--';
    document.getElementById('adminLeavesCounted').textContent   = firstRow[idx.adminC]     || '--';
    document.getElementById('adminLeavesRemaining').textContent = firstRow[idx.adminR]     || '--';
  }

  // 3) للعرض في الجدول، نُصفي أي صف لا يحتوي على تاريخ
  const rows = allRows.filter(r =>
    String(r[idx.date]).trim() !== ''
  );

  const tbody = document.getElementById('attendanceBody');
  tbody.innerHTML = '';

  if (!rows.length) {
    document.getElementById('noDataMsg').classList.remove('hidden');
    return;
  }
  document.getElementById('noDataMsg').classList.add('hidden');

  // 4) بناء صفوف الجدول
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border px-4 py-2">${r[idx.code]  || ''}</td>
      <td class="border px-4 py-2">${r[idx.name]  || ''}</td>
      <td class="border px-4 py-2">${caseMapping[String(r[idx.status]).trim()] || ''}</td>
      <td class="border px-4 py-2">${r[idx.day]  || ''}</td>
      <td class="border px-4 py-2">${r[idx.date]  || ''}</td>
      <td class="border px-4 py-2">${r[idx.in]    || ''}</td>
      <td class="border px-4 py-2">${r[idx.out]   || ''}</td>
      <td class="border px-4 py-2">${r[idx.sFrom] || ''}</td>
      <td class="border px-4 py-2">${r[idx.sTo]   || ''}</td>
      <td class="border px-4 py-2">${r[idx.mFrom] || ''}</td>
      <td class="border px-4 py-2">${r[idx.mTo]   || ''}</td>
      <td class="border px-4 py-2">${r[idx.days]  || ''}</td>
      <td class="border px-4 py-2">${r[idx.notes] || ''}</td>
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
    if (!res.ok || !res.headers.get('content-type').includes('application/json')) {
      alert('البيانات غير متوفرة حالياً.');
      return;
    }

    const { headers, data } = await res.json();
    headersTq = headers;
    tqeemData = data;

    // 1) رفع الإخفاء
    const section = document.getElementById('tqeemSection');
    section.classList.remove('hidden');

    // 2) تفريغ الجدول
    const tbody = document.getElementById('tqeemBody');
    tbody.innerHTML = '';

    // 3) عرض رسالة إن خلت البيانات
    document.getElementById('noTqeemMsg')
      .classList.toggle('hidden', data.length > 0);

    // 4) بناء الصفوف
    data.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="border px-4 py-2">${r[headers.indexOf('رقم الموظف')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('الاسم')]       || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('حجم العمل')]   || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('اتقان العمل وفعاليته')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('المهارات القيادية')]  || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('مهارة الإدارة الذاتية')] || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('مهارات التواصل والتفاعل')]|| ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('المبادرة والتطوير الذاتي')]  || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('الاستقلال والموثوقية')]   || ''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('الالتزام والمسؤولية')]   || ''}</td>
      `;
      tbody.appendChild(tr);
    });

    // 5) التمرير أوتوماتيكيًا إلى القسم
    section.scrollIntoView({ behavior: 'smooth' });

  } catch (e) {
    console.error('❌ showTqeem error:', e);
    alert('حدث خطأ أثناء جلب بيانات التقييم السنوي.');
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
