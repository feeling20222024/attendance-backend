// —————————————————————————————————————————
// public/js/app.js
// —————————————————————————————————————————

// —————————————————————————————————————————
// 0) ثوابت التخزين والنقاط النهائية
// —————————————————————————————————————————
const API_BASE       = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT = `${API_BASE}/login`;
const NOTIFS_ENDPOINT= `${API_BASE}/notifications`;
const STORAGE_KEY    = 'notificationsLog';
const SUPERVISOR_CODE= '35190';

let jwtToken    = null;
let currentUser = null;

// —————————————————————————————————————————
// Helper: تطبيع أرقام عربية → غربية
// —————————————————————————————————————————
function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
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
  const list = document.getElementById('notificationsLog');
  const clearBtn = document.getElementById('clearNotifications');
  const nots = loadNotificationsLocal();
  if (!list || !clearBtn) return;

  list.innerHTML = '';
  if (nots.length === 0) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    clearBtn.classList.add('hidden');
  } else {
    nots.forEach(n => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${n.title}</strong><br>${n.body}<br><small>${n.time}</small>`;
      li.className = 'mb-2 border-b pb-1';
      list.appendChild(li);
    });
    // زر مسح للمشرف فقط
    if (currentUser === SUPERVISOR_CODE) {
      clearBtn.classList.remove('hidden');
    } else {
      clearBtn.classList.add('hidden');
    }
  }
}
function clearNotifications() {
  if (currentUser !== SUPERVISOR_CODE) return alert('ليس لديك صلاحية');
  if (!confirm('مسح جميع الإشعارات؟')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  updateBellCount();
}

// —————————————————————————————————————————
// دالة جلب الإشعارات من الخادم وحفظها محليًا
// —————————————————————————————————————————
window.loadNotificationsFromServer = async function() {
  try {
    const res = await fetch(NOTIFS_ENDPOINT, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const { data } = await res.json();
    saveNotificationsLocal(data);
    renderNotifications();
    updateBellCount();
  } catch (e) {
    console.warn('❌ لم يتم جلب الإشعارات من الخادم:', e);
  }
};

// —————————————————————————————————————————
// دالة addNotification تُستخدم من push.js و SW
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
// DOMContentLoaded: ربط الأزرار وجلب الإشعارات
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').onclick  = login;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('aboutBtn').onclick  = () =>
    alert('فكرة وإعداد وتصميم عمر عونـي السابق');
  document.getElementById('hwafezBtn').onclick = showHwafez;
  document.getElementById('tqeemBtn').onclick  = showTqeem;
  document.getElementById('clearNotifications').onclick = clearNotifications;

  const savedToken = localStorage.getItem('jwtToken');
  if (savedToken) {
    jwtToken = savedToken;
    // 1) جلب البيانات
    fetchAndRender()
      .then(async () => {
        // 2) تهيئة الإشعارات (SW + FCM)
        if (typeof window.initNotifications === 'function') {
          await window.initNotifications();
        }
        // 3) جلب سجل الإشعارات من الخادم
        await window.loadNotificationsFromServer();
      })
      .catch(logout);
  }
});

// —————————————————————————————————————————
async function login() {
  const code = normalizeDigits(document.getElementById('codeInput').value.trim());
  const pass = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) return alert('يرجى إدخال الكود وكلمة المرور.');

  try {
    // 1) طلب تسجيل الدخول
    const res = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, pass })
    });
    if (res.status === 401) return alert('بيانات الدخول خاطئة');
    if (!res.ok) throw new Error(`Status ${res.status}`);

    // 2) استلام التوكن وتهيئة المصادقة محلياً
    const json = await res.json();
    jwtToken = json.token;
    localStorage.setItem('jwtToken', jwtToken);

    // 3) currentUser وتخزينه
    currentUser = json.user.code ?? json.user['كود الموظف'];
    window.currentUser = currentUser;
    if (typeof window.initPush === 'function') {
  await window.initPush();
}
    console.log('✅ login successful, user =', currentUser);

    // ↓ هنا نضيف جلب الإشعارات من السيرفر ↓
    try {
      const notifRes = await fetch(`${API_BASE}/notifications/${currentUser}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${jwtToken}`
        }
      });
      if (notifRes.ok) {
        const serverNotifs = await notifRes.json();
        // خزنها في localStorage لكي تكون موحدة
        localStorage.setItem('notificationsLog', JSON.stringify(serverNotifs));
        // حدّث اللوحة والعداد
        if (typeof window.renderNotifications === 'function') {
          window.renderNotifications();
        }
        if (typeof window.updateBellCount === 'function') {
          window.updateBellCount();
        }
      } else {
        console.warn('Failed to fetch server notifications:', notifRes.status);
      }
    } catch (e) {
      console.warn('Error fetching server notifications:', e);
    }

    // 4) ثبّت الاستقبال الفوري للإشعارات
    if (typeof window.initNotifications === 'function') {
      await window.initNotifications();
    }

    // 5) ثبّت الـ push (ويب + Native)
    console.log('🚀 calling initPush()…');
    if (window.Capacitor && Capacitor.getPlatform() !== 'web') {
      await initPushNative();
    } else {
      await initPush();
    }

    // 6) وأخيراً: جلب باقي بيانات التطبيق
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
