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

    // 6) جلب وعرض البيانات
    await fetchAndRender();


  } catch (e) {
    console.error('❌ login error:', e);
    alert('حدث خطأ أثناء تسجيل الدخول: ' + e.message);
  }
}

// —————————————————————————————————————————
// 3) جلب وعرض البيانات (attendance + hwafez + me)
// —————————————————————————————————————————
async function fetchAndRender() {
  if (!jwtToken) return;

  // تهيئة الهيدر
  const headersReq = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}`
  };

  // جلب البيانات من ثلاث نقاط نهاية دفعة واحدة
  const [aRes, hwRes, meRes] = await Promise.all([
    fetch(`${API_BASE}/attendance`, { headers: headersReq }),
    fetch(`${API_BASE}/hwafez`,      { headers: headersReq }),
    fetch(`${API_BASE}/me`,          { headers: headersReq })
  ]);
  if (!aRes.ok || !hwRes.ok || !meRes.ok) throw new Error('Unauthorized');

  // فك الاستجابة الخاصة بالحضور، مع generalNote
  const aJson   = await aRes.json();
  const hwJson  = await hwRes.json();
  const meJson  = await meRes.json();

  // تعيين المتغيرات العالمية
  headersAtt      = aJson.headers;
  attendanceData  = aJson.data;
  const generalNote = aJson.generalNote;        // ← الملاحظة العامة
  headersHw       = hwJson.headers;
  hwafezData      = hwJson.data;
  currentUser     = meJson.user['كود الموظف'];

  // ————————— عرض الملاحظة العامة إذا وُجدت —————————
  if (generalNote) {
    const generalBox  = document.getElementById('generalNoteBox');
    const generalText = document.getElementById('generalNoteText');
    generalText.textContent = generalNote;
    generalBox.classList.remove('hidden');
  }


 // ————————— عرض الملاحظة الثابتة للجميع —————————
const privateNoteIndex = headersAtt.indexOf("تنبيهات وملاحظات عامة");
if (privateNoteIndex !== -1 && attendanceData.length > 0) {
  const privateNote = attendanceData[0][privateNoteIndex] || '';
  const noteBox = document.getElementById('supervisorNotes');
  if (noteBox) {
    noteBox.textContent = privateNote.trim();
  }
}



  // ————————— إظهار واجهة المستخدم —————————
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('records').classList.remove('hidden');
  document.getElementById('welcomeMsg').textContent = `مرحباً ${currentUser}`;

  // إذا كان المشرف، أظهر قسم الإشعارات
  if (currentUser === SUPERVISOR_CODE) {
    document.getElementById('pushSection').classList.remove('hidden');
    document.getElementById('sendPushBtn').onclick = sendSupervisorNotification;
  }

  // ثم عرض السجلات
  renderRecords();
}
 // ← تم إغلاق الدالة الآن

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
