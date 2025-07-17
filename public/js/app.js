// —————————————————————————————————————————
// public/js/app.js
// —————————————————————————————————————————

// —————————————————————————————————————————
// 0) ثوابت التخزين ونقاط النهاية
// —————————————————————————————————————————
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT  = `${API_BASE}/login`;
const NOTIFS_ENDPOINT = `${API_BASE}/notifications`;
const STORAGE_KEY     = 'notificationsLog';
const SUPERVISOR_CODE = '35190';
// —————————————————————————————————————————
// جلب إشعارات المستخدم من السيرفر وتخزينها محلياً
// —————————————————————————————————————————
async function loadNotificationsFromServer() {
  if (!window.currentUser) return [];
  try {
    const res = await fetch(`${API_BASE}/notifications/${window.currentUser}`);
    if (!res.ok) {
      console.warn('لم يتم جلب الإشعارات من السيرفر:', res.status);
      return [];
    }
    const arr = await res.json();
    // تأكد أنها مصفوفة من { title, body, time }
    if (!Array.isArray(arr)) {
      console.warn('رد غير متوقع من السيرفر:', arr);
      return [];
    }
    // خزّنها في localStorage
    localStorage.setItem('notificationsLog', JSON.stringify(arr));
    return arr;
  } catch (e) {
    console.warn('❌ لم يتم جلب إشعارات الخادم:', e);
    return [];
  }
}


let headersAtt      = [], attendanceData = [];
let headersHw       = [], hwafezData     = [];
let headersTq       = [], tqeemData      = [];
let currentUser     = null;
let jwtToken        = null;

// —————————————————————————————————————————
// Helper: تطبيع أرقام عربية → غربية
// —————————————————————————————————————————
function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, d =>
    '٠١٢٣٤٥٦٧٨٩'.indexOf(d)
  );
}

// —————————————————————————————————————————
// دوال التخزين المحلية + العرض
// —————————————————————————————————————————
function loadNotificationsLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}
function saveNotificationsLocal(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}
function updateBellCount() {
  const cnt = loadNotificationsLocal().length;
  const el  = document.getElementById('notifCount');
  if (!el) return;
  el.textContent = cnt;
  el.style.display = cnt > 0 ? 'inline-block' : 'none';
}
function renderNotifications() {
  const list     = document.getElementById('notificationsLog');
  const clearBtn = document.getElementById('clearNotifications');
  const nots     = loadNotificationsLocal();
  if (!list || !clearBtn) return;

  list.innerHTML = '';
  if (nots.length === 0) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    clearBtn.classList.add('hidden');
  } else {
    nots.forEach(n => {
      const li = document.createElement('li');
      li.innerHTML = `
        <strong>${n.title}</strong><br>
        ${n.body}<br>
        <small class="text-gray-400">${n.time}</small>
      `;
      li.className = 'mb-2 border-b pb-1';
      list.appendChild(li);
    });
    if (currentUser === SUPERVISOR_CODE) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }
}
function clearNotifications() {
  if (currentUser !== SUPERVISOR_CODE) {
    return alert('ليس لديك صلاحية لمسح الإشعارات.');
  }
  if (!confirm('هل تريد مسح جميع الإشعارات؟')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  updateBellCount();
}

// —————————————————————————————————————————
// جلب الإشعارات من الخادم وحفظها محليًا
// —————————————————————————————————————————
window.loadNotificationsFromServer = async function() {
  try {
    const res = await fetch(NOTIFS_ENDPOINT, {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const result = await res.json();
    // الخادم يرجع { data: [ { title, body, time }, ... ] }
    const arr = result.data || [];
    saveNotificationsLocal(arr);
    renderNotifications();
    updateBellCount();
  } catch (e) {
    console.warn('❌ لم يتم جلب إشعارات الخادم:', e);
  }
};

// —————————————————————————————————————————
// إضافة إشعار يُستدعى من push.js أو الـ SW
// —————————————————————————————————————————
window.addNotification = function({ title, body, time }) {
  const arr = loadNotificationsLocal();
  arr.unshift({ title, body, time });
  if (arr.length > 50) arr.pop();
  saveNotificationsLocal(arr);
  renderNotifications();
  updateBellCount();
};

// —————————————————————————————————————————
// DOMContentLoaded: ربط الأزرار وجلب الإشعارات المخبأة
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').onclick          = login;
  document.getElementById('logoutBtn').onclick         = logout;
  document.getElementById('aboutBtn').onclick          = () =>
    alert('فكرة وإعداد وتصميم عمر عوني');
  document.getElementById('hwafezBtn').onclick         = showHwafez;
  document.getElementById('tqeemBtn').onclick          = showTqeem;
  document.getElementById('clearNotifications').onclick = clearNotifications;

  // إذا كان هناك JWT محفوظ
  const saved = localStorage.getItem('jwtToken');
  if (saved) {
    jwtToken = saved;
    // 1) جلب البيانات
    fetchAndRender()
      .then(async () => {
        // 2) تهيئة إشعارات الويب (SW + FCM)
        if (typeof window.initNotifications === 'function') {
          await window.initNotifications();
        }
        // 3) جلب سجل الإشعارات الموحد من الخادم
        await window.loadNotificationsFromServer();
      })
      .catch(logout);
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
    // طلب المصادقة
    const res = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, pass })
    });
    if (res.status === 401) {
      return alert('بيانات الدخول خاطئة.');
    }
    if (!res.ok) {
      throw new Error(`خطأ (${res.status})`);
    }

    // استلام التوكن
    const loginResponse = await res.json();
    jwtToken    = loginResponse.token;
    currentUser = loginResponse.user.code
                ?? loginResponse.user['كود الموظف'];
    window.currentUser = currentUser;
    localStorage.setItem('jwtToken', jwtToken);

    console.log('✅ login successful, currentUser =', currentUser);

    // جلب البيانات وعرض الواجهة
    await fetchAndRender();

    // تهيئة إشعارات الويب
    if (typeof window.initNotifications === 'function') {
      await window.initNotifications();
    }
    // جلب سجل الإشعارات بعد تسجيل الدخول
    await window.loadNotificationsFromServer();

  } catch (e) {
    console.error('❌ login error:', e);
    alert('حدث خطأ أثناء تسجيل الدخول: ' + e.message);
  }
}

// —————————————————————————————————————————
// 2) جلب وعرض البيانات (attendance + hwafez + me)
// —————————————————————————————————————————
async function fetchAndRender() {
  if (!jwtToken) return;

  const headers = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${jwtToken}`
  };

  // طلب الحضور، الحوافز، وبيانات المستخدم
  const [aRes, hwRes, meRes] = await Promise.all([
    fetch(`${API_BASE}/attendance`, { headers }),
    fetch(`${API_BASE}/hwafez`,      { headers }),
    fetch(`${API_BASE}/me`,          { headers }),
  ]);

  // إذا انتهت الجلسة
  if ([aRes, hwRes, meRes].some(r => r.status === 401)) {
    console.warn('❌ Session expired → logout');
    logout();
    return;
  }

  // عرض الجداول
  const aJson  = await aRes.json();
  const hwJson = await hwRes.json();
  const meJson = await meRes.json();

  headersAtt     = aJson.headers;     attendanceData = aJson.data;
  headersHw      = hwJson.headers;    hwafezData     = hwJson.data;
  currentUser    = meJson.user['كود الموظف'];

  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('records').classList.remove('hidden');
  document.getElementById('welcomeMsg').textContent = `مرحباً ${currentUser}`;

  if (currentUser === SUPERVISOR_CODE) {
    document.getElementById('pushSection').classList.remove('hidden');
    document.getElementById('sendPushBtn')
            .onclick = sendSupervisorNotification;
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
// 3) رسم سجلات الحضور للمستخدم الحالي
// —————————————————————————————————————————
function renderRecords() {
  const idx = {
    code:   headersAtt.indexOf('رقم الموظف'),
    name:   headersAtt.indexOf('الاسم'),
    status: headersAtt.indexOf('الحالة'),
    date:   headersAtt.indexOf('التاريخ'),
    in:     headersAtt.indexOf('دخول'),
    out:    headersAtt.indexOf('خروج'),
    days:   headersAtt.indexOf('عدد الأيام المحتسبة بتقرير الساعيات أو التأخر أقل من ساعة'),
    notes:  headersAtt.indexOf('ملاحظات'),
    adminC: headersAtt.indexOf('عدد الإجازات الإدارية المحتسبة للعامل'),
    adminR: headersAtt.indexOf('عدد الإجازات الإدارية المتبقية للعامل'),
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
      <td class="border px-4 py-2">${r[idx.status]||''}</td>
      <td class="border px-4 py-2">${r[idx.date]||''}</td>
      <td class="border px-4 py-2">${r[idx.in]||''}</td>
      <td class="border px-4 py-2">${r[idx.out]||''}</td>
      <td class="border px-4 py-2">${r[idx.days]||''}</td>
      <td class="border px-4 py-2">${r[idx.notes]||''}</td>
    `;
    tbody.appendChild(tr);
  });
}

// —————————————————————————————————————————
// 4) عرض بيانات الحوافز
// —————————————————————————————————————————
async function showHwafez() {
  try {
    const res = await fetch(`${API_BASE}/hwafez`, {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    if (!res.ok) throw new Error('فشل جلب بيانات الحوافز');
    const { headers, data } = await res.json();
    headersHw  = headers; hwafezData = data;

    document.getElementById('hwafezSection')
            .classList.remove('hidden');
    const tbody = document.getElementById('hwafezBody');
    tbody.innerHTML = '';

    if (!data.length) {
      document.getElementById('noHwafezMsg')
              .classList.remove('hidden');
      return;
    }
    document.getElementById('noHwafezMsg')
            .classList.add('hidden');

    data.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="border px-4 py-2">${r[headers.indexOf('رقم الموظف')]||''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('الاسم')]||''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('حجم العمل')]||''}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('❌ showHwafez error:', e);
    alert('حدث خطأ أثناء جلب الحوافز');
  }
}

// —————————————————————————————————————————
// 5) عرض بيانات التقييم السنوي
// —————————————————————————————————————————
async function showTqeem() {
  try {
    const res = await fetch(`${API_BASE}/tqeem`, {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    if (!res.ok) throw new Error('فشل جلب التقييم السنوي');
    const { headers, data } = await res.json();
    headersTq  = headers; tqeemData = data;

    const section = document.getElementById('tqeemSection');
    section.classList.remove('hidden');
    const tbody = document.getElementById('tqeemBody');
    tbody.innerHTML = '';

    if (!data.length) {
      document.getElementById('noTqeemMsg')
              .classList.remove('hidden');
      return;
    }
    document.getElementById('noTqeemMsg')
            .classList.add('hidden');

    data.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="border px-4 py-2">${r[headers.indexOf('رقم الموظف')]||''}</td>
        <td class="border px-4 py-2">${r[headers.indexOf('الاسم')]||''}</td>
      `;
      tbody.appendChild(tr);
    });
  } catch (e) {
    console.error('❌ showTqeem error:', e);
    alert('حدث خطأ أثناء جلب التقييم السنوي');
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
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ title, body })
    });
    if (!res.ok) throw new Error(await res.text());
    alert('✅ تم إرسال الإشعار.');
    document.getElementById('notifTitleInput').value = '';
    document.getElementById('notifBodyInput').value  = '';
  } catch (err) {
    console.error('❌ sendPush error:', err);
    alert('حدث خطأ في الإرسال: ' + err.message);
  }
}

// —————————————————————————————————————————
// 7) تسجيل الخروج
// —————————————————————————————————————————
function logout() {
  currentUser = null;
  jwtToken    = null;
  localStorage.removeItem('jwtToken');
  document.getElementById('loginSection').classList.remove('hidden');
  ['records','pushSection','hwafezSection','tqeemSection']
    .forEach(id => document.getElementById(id).classList.add('hidden'));
}
