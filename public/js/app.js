// —————————————————————————————————————————
// 1) نقطة النهاية وجزء التسجيل
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

document.addEventListener('DOMContentLoaded', () => {
  // 2) إذا كانت push.js متوفرة (Service Worker)، نهيّئ الإشعارات
  //    ولكن لا نستدعي initPush هنا تلقائيًا؛ ننتظر نجاح تسجيل الدخول أولًا
  if (window.initPush) {
    try {
      // لن نستدعي initPush إلا بعد تسجيل الدخول بنجاح
    } catch {
      console.warn('initPush غير متوفّرة أو Capacitor غير مدعوم هنا.');
    }
  }

  // 3) ربط أزرار الواجهة
  document.getElementById('loginBtn').onclick  = login;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('aboutBtn').onclick  = () =>
    alert('فكرة وإعداد وتصميم عمر عوني الماضي – دائرة الموارد البشرية – اتصالات دمشق');
  document.getElementById('hwafezBtn').onclick = showHwafez;
});

// —————————————————————————————————————————
// 4) دالة جلب البيانات (المحمية بـ JWT)
// —————————————————————————————————————————
async function fetchAndRender() {
  if (!jwtToken) return;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  };

  console.log('🚀 fetching protected data...');
  try {
    // نجلب الحضور والحوافز والمستخدم في نفس الوقت
    const [aRes, hwRes, meRes] = await Promise.all([
      fetch(`${API_BASE}/attendance`, { headers }),
      fetch(`${API_BASE}/hwafez`,     { headers }),
      fetch(`${API_BASE}/me`,         { headers })
    ]);

    if (!aRes.ok || !hwRes.ok || !meRes.ok) {
      throw new Error('فشل جلب البيانات (ربما انتهت صلاحية الجلسة)');
    }

    const aJson  = await aRes.json();
    const hwJson = await hwRes.json();
    const meJson = await meRes.json();

    headersAtt      = aJson.headers;
    attendanceData  = aJson.data;
    headersHw       = hwJson.headers;
    hwafezData      = hwJson.data;
    currentUser     = meJson.user['كود الموظف'];

    console.log('✅ Data fetched. currentUser =', currentUser);

    // إظهار الواجهة بعد تسجيل الدخول
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('records').classList.remove('hidden');
    document.getElementById('welcomeMsg').textContent = `مرحباً ${currentUser}`;

    // إذا كان المشرف، نظهر قسم الإشعارات
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

    // أخيرًا، عرض سجلات الحضور مباشرةً
    renderRecords();

  } catch (e) {
    console.error('❌ fetchAndRender error:', e);
    // إذا انتهت صلاحية التوكن أو حصل خطأ آخر، نعيد تسجيل الخروج
    logout();
  }
}

// —————————————————————————————————————————
// 5) دالة تسجيل الدخول (POST إلى /api/login للحصول على JWT)
// —————————————————————————————————————————
async function login() {
  console.log('🔑 login() called');
  try {
    let code = document.getElementById('codeInput').value.trim();
    let pass = document.getElementById('passwordInput').value.trim();
    if (!code || !pass) {
      alert('يرجى إدخال الكود وكلمة المرور.');
      return;
    }

    // نرسل بيانات الدخول إلى المسار /api/login
    const res = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, pass })
    });

    if (!res.ok) {
      if (res.status === 401) {
        alert('بيانات الدخول خاطئة');
        return;
      }
      throw new Error(`فشل تسجيل الدخول (رمز الخطأ: ${res.status})`);
    }

    const body = await res.json();
    console.log('📝 login response:', body);
    const { token, user } = body;

    if (!token || !user || !user.code) {
      console.error('⚠️ الرد من /login لا يحوي "token" أو "user.code"');
      alert('حدث خطأ غير متوقع أثناء تسجيل الدخول');
      return;
    }

    jwtToken = token;
    localStorage.setItem('jwtToken', token);

    // خزنّا currentUser ليسمح لـ push.js بالوصول إليه
    currentUser = user.code;
    window.currentUser = currentUser;

    console.log('🔑 login successful. currentUser =', currentUser);

    // فور نجاح تسجيل الدخول، نستدعي initPush إن وجدت
    if (window.initPush) {
      console.log('🚀 calling initPush()...');
      initPush();
    }

    // نبدأ جلب وعرض البيانات
    await fetchAndRender();

  } catch (e) {
    console.error('❌ login error:', e);
    alert('حدث خطأ أثناء تسجيل الدخول');
  }
}

// —————————————————————————————————————————
// 6) دالة رسم سجلات الحضور للمستخدم الحالي
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

  // إحصائيات الصفّ الأول
  const first = rows[0];
  document.getElementById('adminLeavesDue').textContent       = first[idx.adminDue]  || '--';
  document.getElementById('adminLeavesCounted').textContent   = first[idx.adminC]    || '--';
  document.getElementById('adminLeavesRemaining').textContent = first[idx.adminR]    || '--';

  // ملء الجدول
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
// 7) دالة عرض بيانات الحوافز (محميّة بJWT) + تمرير تلقائي للتمرير
// —————————————————————————————————————————
async function showHwafez() {
  try {
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    };
    const res = await fetch(`${API_BASE}/hwafez`, { headers });
    if (!res.ok) {
      throw new Error('فشل جلب بيانات الحوافز');
    }
    const json = await res.json();
    headersHw  = json.headers;
    hwafezData = json.data;

    // إظهار قسم الحوافز
    document.getElementById('hwafezSection').classList.remove('hidden');

    const idxHw = {
      code:   headersHw.indexOf('رقم الموظف'),
      name:   headersHw.indexOf('الاسم'),
      fields: [
        'حجم العمل', 'اتقان العمل وفعاليته', 'المهارات القيادية', 'مهارة الإدارة الذاتية',
        'مهارات التواصل والتفاعل', 'المبادرة والتطوير الذاتي', 'الإستقلال والموثوقية',
        'الإلتزام والمسؤولية', 'نسبة الدوام الفعلي للعامل', 'السويّة الوظيفيّة',
        'مستوى التأهيل', 'سنوات الخبرة'
      ].map(h => headersHw.indexOf(h))
    };

    const rows = hwafezData.filter(r =>
      String(r[idxHw.code]).trim() === currentUser
    );

    const tbody = document.getElementById('hwafezBody');
    tbody.innerHTML = '';

    if (!rows.length) {
      document.getElementById('noHwafezMsg').classList.remove('hidden');
      return;
    }
    document.getElementById('noHwafezMsg').classList.add('hidden');

    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="border px-4 py-2">${r[idxHw.code]||''}</td>
        <td class="border px-4 py-2">${r[idxHw.name]||''}</td>
        ${idxHw.fields.map(i => `<td class="border px-4 py-2">${r[i]||''}</td>`).join('')}
      `;
      tbody.appendChild(tr);
    });

    // تمرير سلسٍّ إلى قسم الحوافز
    document.getElementById('hwafezSection').scrollIntoView({ behavior: 'smooth' });

  } catch (e) {
    console.error('❌ showHwafez error:', e);
    alert('حدث خطأ أثناء جلب بيانات الحوافز');
  }
}

// —————————————————————————————————————————
// 8) دالة إرسال إشعار للمشرف (محميّة بJWT)
// —————————————————————————————————————————
async function sendSupervisorNotification() {
  try {
    // 1) نقرأ العنوان والنص من المدخلات
    const title = document.getElementById('notifTitleInput').value.trim();
    const body  = document.getElementById('notifBodyInput').value.trim();

    if (!title || !body) {
      alert('يرجى إدخال عنوان ونص الإشعار.');
      return;
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    };

    // 2) نرسل الطلب مع العنوان والنص
    const res = await fetch(`${API_BASE}/notify-all`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title, body })
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || `رمز الخطأ: ${res.status}`);
    }

    alert('✅ تم إرسال الإشعار لجميع المستخدمين.');
    // مسح الحقول بعد الإرسال
    document.getElementById('notifTitleInput').value = '';
    document.getElementById('notifBodyInput').value  = '';

  } catch (err) {
    console.error('❌ sendSupervisorNotification error:', err);
    alert('❌ خطأ في إرسال الإشعار: ' + err.message);
  }
}

// —————————————————————————————————————————
// 9) تسجيل الخروج: مسح التوكن وإظهار واجهة تسجيل الدخول
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
