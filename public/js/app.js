// تسجيل الـ SW فقط
navigator.serviceWorker.register('/sw.js')
  .then(async _ => {
    console.log('✅ SW registered');
    const swReg = await navigator.serviceWorker.ready;
    console.log('✅ SW ready:', swReg.scope);

    navigator.serviceWorker.addEventListener('message', event => {
      const msg = event.data;
      if (msg?.type === 'NEW_NOTIFICATION') {
        window.addNotification({
          title: msg.title,
          body:  msg.body,
          time:  new Date(msg.timestamp).toLocaleString()
        });
      }
    });
  })
  .catch(err => console.warn('❌ SW register failed', err));

// —————————————————————————————————————————
// 1) إعداد نقاط النهاية والمتغيرات العامة
// —————————————————————————————————————————
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT  = `${API_BASE}/login`;
const SUPERVISOR_CODE = '35190';

let headersAtt       = [], attendanceData = [];
let headersHw        = [], hwafezData      = [];
let headersTq        = [], tqeemData       = [];
let currentUser      = null;
let jwtToken         = localStorage.getItem('jwtToken') || null;
window.serverNotifications = [];



// 3) دوال التنبيهات
// —————————————————————————————————————————

// 3.1) رسم العداد وسجل الإشعارات
window.renderNotifications = function(arr = window.serverNotifications) {
  const list       = document.getElementById('notificationsLog');
  const countBadge = document.getElementById('notifCount');
  const clearBtn   = document.getElementById('clearNotifications');
  if (!list || !countBadge || !clearBtn) return;

  list.innerHTML = arr.length
    ? arr.map(n => `
        <li class="mb-2 border-b pb-1">
          <strong>${n.title}</strong><br>
          <small>${n.body}</small><br>
          <small class="text-gray-400">${n.time}</small>
        </li>
      `).join('')
    : '<li class="text-gray-500">لا توجد إشعارات</li>';

  countBadge.textContent    = arr.length;
  countBadge.style.display  = arr.length ? 'inline-block' : 'none';
  clearBtn.style.display    = (window.currentUser === SUPERVISOR_CODE && arr.length)
                             ? 'block' : 'none';
};

// 3.2) جلب سجل الإشعارات من الخادم
function filterDuplicates(arr) {
  const seen = new Set();
  return arr.filter(n => {
    const key = `${n.title}|${n.body}|${n.time}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

window.openNotificationLog = async function() {
  if (!window.jwtToken) {
    window.renderNotifications();
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${window.jwtToken}`
      }
    });
    if (!res.ok) throw new Error();
    let { notifications } = await res.json();
    notifications = filterDuplicates(notifications);
    window.serverNotifications = notifications || [];
  } catch {
    window.serverNotifications = [];
  }
  window.renderNotifications();
};

// 3.3) تهيئة التنبيهات عند تحميل الواجهة (تعبئة العداد أوليًّا)
async function initNotifications() {
  if (!jwtToken) return;

  // حماية لمنع إضافة مستمع الرسائل أكثر من مرة
  if (!window.messageListenerAdded) {
    // استمع لرسائل Service Worker (رسائل الخلفية)
    navigator.serviceWorker.addEventListener('message', event => {
      const msg = event.data;
      if (msg?.type === 'NEW_NOTIFICATION') {
        window.addNotification({
          title: msg.title,
          body: msg.body,
          time: formatDamascusTime(new Date(msg.timestamp))
        });
      }
    });
    window.messageListenerAdded = true;
  }

  // حماية لمنع إضافة مستمع Firebase onMessage أكثر من مرة
  if (!window.onMessageAdded && window.messagingInstance) {
    onMessage(window.messagingInstance, payload => {
      const { title = '', body = '' } = payload.notification || {};
      if (Notification.permission === 'granted') {
        new Notification(title, { body });
      }
      window.addNotification({
        title,
        body,
        time: formatDamascusTime(new Date())
      });
    });
    window.onMessageAdded = true;
  }

  // جلب سجل الإشعارات من السيرفر
  await openNotificationLog();
}

// دالة لتنسيق الوقت بتوقيت دمشق بدون ثواني
function formatDamascusTime(date) {
  // تحويل الوقت إلى توقيت UTC+3
  // التوقيت المحلي لدمشق +3 ساعات على UTC بدون التوقيت الصيفي المعقد
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const damascusTime = new Date(utc + 3 * 3600000);

  // تنسيق التاريخ والوقت بدون ثواني
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  };
  return damascusTime.toLocaleString('ar-SY', options);
}
// 4) ربط أحداث الـ DOM بعد التحميل
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  const panel    = document.getElementById('notificationsPanel');
  const clearBtn = document.getElementById('clearNotifications');

  document.body.addEventListener('click', () => {
    if (!panel.classList.contains('hidden')) panel.classList.add('hidden');
  });

  // فقط إذا تم تسجيل الدخول
  if (jwtToken && currentUser) {
    window.renderNotifications();
  }
  
  clearBtn?.addEventListener('click', async e => {
    e.stopPropagation();
    if (window.currentUser !== SUPERVISOR_CODE) return;
    if (!confirm('مسح جميع الإشعارات؟')) return;
    await fetch(`${API_BASE}/notifications`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${window.jwtToken}` }
    });
    window.serverNotifications = [];
    window.renderNotifications();
  });

  // تحديث أولي للعداد
  window.renderNotifications();
});

// 6) إعداد Firebase Messaging للرسائل الحيّة في الواجهة
// —————————————————————————————————————————
const firebaseConfig = {
  apiKey:            "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:        "device-streaming-47cbe934.firebaseapp.com",
  projectId:         "device-streaming-47cbe934",
  storageBucket:     "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId:             "1:235398312189:web:8febe5e63f7b134b808e94"
};
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);


// 7) إذا كان المستخدم سابقاً مُسجَّلاً فاجلب بياناته وتهيئة التنبيهات
// —————————————————————————————————————————
const saved = localStorage.getItem('jwtToken');
if (saved) {
  jwtToken = saved;
  fetchAndRender()
    .then(() => initNotifications())
    .catch(logout);
}


// —————————————————————————————————————————
// بقية app.js: تسجيل الدخول، جلب البيانات، الخ…
/* … تابع باقية دوال login, fetchAndRender, renderRecords, showHwafez, showTqeem, sendSupervisorNotification, logout … */

// —————————————————————————————————————————
// 6) خريطة حالات التأخير (مثال)
// —————————————————————————————————————————
const caseMapping = {
  '1': "غياب غير مبرر (بدون إذن رسمي)",
  '2': "تأخر أكثر من ساعة أو عدم مهر البصمة صباحاً",
  '3': "خروج مبكر (أو عدم مهر البصمة مساءً)",
  '4': "عدد مرات التأخر أقل من ساعة (حسم يوم كل 3 تأخيرات)",
  '5': "تجميع ساعيات (كل ثماني ساعات يتم احتساب يوم)"
};

// —————————————————————————————————————————
// 7) تطبيع الأرقام العربية → غربية
// —————————————————————————————————————————
function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}
// —————————————————————————————————————————
// —————————————————————————————————————————


// تسجيل الدخول / الخروج
const loginBtn  = document.getElementById('loginBtn');
const logoutBtn = document.getElementById('logoutBtn');
if (loginBtn)  loginBtn.onclick  = login;
if (logoutBtn) logoutBtn.onclick = logout;
// ✅ إضافة دعم زر Enter لتسجيل الدخول
document.addEventListener('keydown', function (e) {
  if (e.key === 'Enter') {
    e.preventDefault(); // لا تعمل refresh
    if (loginBtn) loginBtn.click();
  }
});
// أزرار القائمة الأخرى
const aboutBtn  = document.getElementById('aboutBtn');
const hwafezBtn = document.getElementById('hwafezBtn');
const tqeemBtn  = document.getElementById('tqeemBtn');
if (aboutBtn)  aboutBtn.onclick  = () =>
  alert('فكرة وإعداد وتصميم عمر عونـي الماضي   دائرة الموارد البشرية – فرع اتصالات دمشق');
if (hwafezBtn) hwafezBtn.onclick = showHwafez;
if (tqeemBtn)  tqeemBtn.onclick  = showTqeem;

   // زر مسح الإشعارات (للمشرف فقط)
const clearBtn = document.getElementById('clearNotifications');
if (clearBtn) {
  clearBtn.onclick = async () => {
    if (currentUser !== SUPERVISOR_CODE) {
      return alert('غير مسموح لك بمسح الإشعارات.');
    }
    try {
      await fetch(`${API_BASE}/notifications`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        }
      });
      serverNotifications = [];
      renderNotifications();
      clearBtn.classList.add('hidden');
      alert('✅ تم مسح جميع الإشعارات.');
    } catch (e) {
      console.error('❌ خطأ في مسح الإشعارات:', e);
      alert('حدث خطأ أثناء مسح الإشعارات.');
    }
  };
}

  // زر إغلاق سجل الإشعارات (داخل اللوحة)
  const closeBtn = document.getElementById('closeNotificationsBtn');
  if (closeBtn) {
    closeBtn.onclick = () => {
      document.getElementById('notificationsPanel')?.classList.add('hidden');
    };
  }
async function login() {
  // (1) طلب الكود والرقم السري
  const code = normalizeDigits(document.getElementById('codeInput').value.trim());
  const pass = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) {
    return alert('يرجى إدخال الكود وكلمة المرور.');
  }

  try {
    // (2) إرسال بيانات الدخول للخادم
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

    // (3) استلام الـ JWT
    const { token, user } = await res.json();

    jwtToken = token;
    window.jwtToken = jwtToken;
    localStorage.setItem('jwtToken', jwtToken);
    // جلب إشعارات المستخدم المحمية بعد تسجيل الدخول
if (typeof openNotificationLog === 'function') {
  try {
    await openNotificationLog();
  } catch (e) {
    console.warn('openNotificationLog after login failed:', e);
  }
}

// تأكد من تهيئة المستمعين/الـ push (إذا لم تكن مهيأة)
if (typeof initNotifications === 'function') {
  try { await initNotifications(); } catch(e){ console.warn('initNotifications error:', e); }
}

    currentUser = user.code ?? user['كود الموظف'];
    window.currentUser = currentUser;

    // (4) تهيئة الـ Push بعد الدخول فقط
    if (!window.pushInitialized) {
      const swReg = await navigator.serviceWorker.ready;
      await window.initPush(swReg);
      window.pushInitialized = true;
      console.log("Push initialized once ✅");
    }

    // (5) تحميل البيانات وبقية التهيئة
    await fetchAndRender();
    await initNotifications();

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

// جلب الملاحظات مرة واحدة
const generalNote  = aJson.generalNote  || '';   // تنبيهات وملاحظات عامة لجميع العاملين
const personalNote = aJson.personalNote || '';   // تنبيهات وملاحظات خاصة بالعامل

// ثم عيّن البيانات العالمية
headersAtt     = aJson.headers;
attendanceData = aJson.data;
headersHw      = hwJson.headers;
hwafezData     = hwJson.data;

// ————————— عرض تنبيهات وملاحظات عامة لجميع العاملين —————————
if (generalNote) {
const generalBox  = document.getElementById('generalNoteBox');
const generalText = document.getElementById('generalNoteText');
if (generalBox && generalText) {
  if (generalNote && String(generalNote).trim()) {
    generalText.textContent = String(generalNote);
    generalBox.classList.remove('hidden');
  } else {
    generalText.textContent = '';
    generalBox.classList.add('hidden');
  }
}

// ————————— عرض تنبيهات وملاحظات خاصة بالعامل —————————
if (personalNote) {
const personalSection = document.getElementById('supervisorNotesSection');
const personalDiv     = document.getElementById('supervisorNotes');
if (personalSection && personalDiv) {
  if (personalNote && String(personalNote).trim()) {
    personalDiv.textContent = String(personalNote);
    personalSection.classList.remove('hidden');
  } else {
    personalDiv.textContent = '';
    personalSection.classList.add('hidden');
  }
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
      return alert('يرجى إدخال عنوان ونص الإشعار.');
    }

    const res = await fetch(`${API_BASE}/notify-all`, {
      method: 'POST',
      headers: {
        'Content-Type':'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ title, body })
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'خطأ غير متوقع من الخادم');
    }

    // 1) استعلام وقت الإرسال
    const now = new Date().toLocaleString();

    // 2) إضافة الإشعار للسجل المحلي لكل المستخدمين يتضمن المشرف نفسه
    if (typeof window.addNotification === 'function') {
      window.addNotification({ title, body, time: now });
    }

    // 3) تحديث الواجهة
    alert('✅ تم إرسال الإشعار لجميع المستخدمين.');
    document.getElementById('notifTitleInput').value = '';
    document.getElementById('notifBodyInput').value  = '';

  } catch (err) {
    console.error('❌ sendSupervisorNotification error:', err);
    alert('❌ خطأ في إرسال الإشعار: ' + err.message);
  }
}

// —————————————————————————————————————————
// عند استقبال إشعار جديد من FCM أثناء عمل التطبيق في الواجهة
// —————————————————————————————————————————
window.addNotification = ({ title, body, time }) => {
  // خزّن في المصفوفة الموحدة
  serverNotifications.unshift({ title, body, time });
  if (serverNotifications.length > 50) {
    serverNotifications.pop();
  }
  // أعد رسم سجل الإشعارات
  renderNotifications();
};


// —————————————————————————————————————————
// 7) تسجيل الخروج
function logout() {
  currentUser = null;
  jwtToken = null;
  window.jwtToken = null;
  localStorage.removeItem('jwtToken');

  // مسح بيانات الجداول في الذاكرة
  headersAtt = []; attendanceData = [];
  headersHw = []; hwafezData = [];
  headersTq = []; tqeemData = [];

  // إخفاء الأقسام
  ['records', 'pushSection', 'hwafezSection', 'tqeemSection'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });

  // تفريغ الجداول
  ['attendanceBody', 'hwafezBody', 'tqeemBody'].forEach(function (id) {
    const b = document.getElementById(id);
    if (b) b.innerHTML = '';
  });

  // إظهار شاشة الدخول
  const loginSection = document.getElementById('loginSection');
  if (loginSection) loginSection.classList.remove('hidden');

  // مسح الملاحظة العامة
  const gn = document.getElementById('generalNote');
  if (gn) { 
    gn.textContent = ''; 
    gn.classList.add('hidden'); 
  }

  // **لا نستدعي renderNotifications بعد الخروج**
}
