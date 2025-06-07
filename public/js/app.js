// js/app.js
// ====================================================================
// إعداد نقاط النهاية والمتغيرات العامة
// ====================================================================
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT  = `${API_BASE}/login`;
const SUPERVISOR_CODE = '35190';

let jwtToken       = null;
let currentUser    = null;
let headersAtt     = [], attendanceData = [];
let headersHw      = [], hwafezData     = [];
const caseMapping  = {
  '1': "غياب غير مبرر (بدون إذن رسمي)",
  '2': "تأخر أكثر من ساعة أو عدم مهر البصمة صباحاً",
  '3': "خروج مبكر (أو عدم مهر البصمة مساءً)",
  '4': "عدد مرات التأخر أقل من ساعة (حسم يوم كل 3 تأخيرات)",
  '5': "تجميع ساعيات (كل ثماني ساعات يتم احتساب يوم)"
};

// ====================================================================
// Helper: هل نحن على منصة Native (Android/iOS) أم web؟
const isNative = window.Capacitor && Capacitor.getPlatform && Capacitor.getPlatform() !== 'web';

// ====================================================================
// DOMContentLoaded: ربط الواجهة وتهيئة الإشعارات
// ====================================================================
document.addEventListener('DOMContentLoaded', () => {
  // 1) ربط أزرار الواجهة
  document.getElementById('loginBtn').onclick  = login;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('aboutBtn').onclick  = () =>
    alert('فكرة وإعداد وتصميم عمر عوني الماضي – دائرة الموارد البشرية – اتصالات دمشق');
  document.getElementById('hwafezBtn').onclick = showHwafez;

  // 2) إن كنا على Native، جهّز Push Notifications
  if (isNative) {
    import('@capacitor/push-notifications')
      .then(({ PushNotifications }) => {
        // اطلب الإذن
        PushNotifications.requestPermissions().then(res => {
          if (res.receive === 'granted') {
            PushNotifications.register();
          }
        });

        // مسجّل التوكن
        PushNotifications.addListener('registration', token => {
          console.log('✅ FCM Token:', token.value);
          // أرسل التوكن للخادم مع الـ JWT
          if (jwtToken && currentUser) {
            fetch(`${API_BASE}/register-token`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${jwtToken}`
              },
              body: JSON.stringify({ user: currentUser, token: token.value })
            }).catch(e => console.warn('Failed to register token:', e));
          }
        });

        PushNotifications.addListener('registrationError', err => {
          console.error('❌ FCM Registration Error:', err);
        });
        PushNotifications.addListener('pushNotificationReceived', notification => {
          console.log('📩 Push Received:', notification);
        });
        PushNotifications.addListener('pushNotificationActionPerformed', action => {
          console.log('📲 Notification tapped:', action);
        });
      })
      .catch(err => console.warn('تعذّر تحميل PushNotifications:', err));
  }
});

// ====================================================================
// 1) تسجيل الدخول: POST /login للحصول على JWT
// ====================================================================
async function login() {
  const code = document.getElementById('codeInput').value.trim();
  const pass = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) {
    return alert('يرجى إدخال الكود وكلمة المرور.');
  }

  try {
    const res = await fetch(LOGIN_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ code, pass })
    });
    if (!res.ok) {
      if (res.status === 401) return alert('بيانات الدخول خاطئة');
      throw new Error(`خطأ بالخادم (${res.status})`);
    }

    const { token, user } = await res.json();
    jwtToken    = token;
    currentUser = user.code;
    localStorage.setItem('jwtToken', jwtToken);

    // بعد تسجيل الدخول الناجح: أعد تهيئة الإشعارات (Native فقط)
    if (isNative) {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const perm = await PushNotifications.requestPermissions();
      if (perm.receive === 'granted') {
        await PushNotifications.register();
      }
    }

    // جلب البيانات وعرضها
    await fetchAndRender();
  } catch (e) {
    console.error('❌ login error:', e);
    alert('فشل تسجيل الدخول');
  }
}

// ====================================================================
// 2) جلب وعرض البيانات المحمية (attendance + hwafez + me)
// ====================================================================
async function fetchAndRender() {
  if (!jwtToken) return;

  const headers = {
    'Content-Type':  'application/json',
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

    headersAtt     = aJson.headers;
    attendanceData = aJson.data;
    headersHw      = hwJson.headers;
    hwafezData     = hwJson.data;
    currentUser    = meJson.user['كود الموظف'];

    // إظهار الواجهة بعد تسجيل الدخول
    document.getElementById('loginSection').classList.add('hidden');
    document.getElementById('records').classList.remove('hidden');
    document.getElementById('welcomeMsg').textContent = `مرحباً ${currentUser}`;

    // لو كان مشرفاً، نظهر قسم الإشعارات
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

// ====================================================================
// 3) عرض سجلات الحضور للمستخدم الحالي
// ====================================================================
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
  document.getElementById('adminLeavesDue').textContent       = first[idx.adminDue]    || '--';
  document.getElementById('adminLeavesCounted').textContent   = first[idx.adminC]      || '--';
  document.getElementById('adminLeavesRemaining').textContent = first[idx.adminR]      || '--';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="border px-4 py-2">${r[idx.code]||''}</td>
      <td class="border px-4 py-2">${r[idx.name]||''}</td>
      <td class="border px-4 py-2">${caseMapping[r[idx.status]] || ''}</td>
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

// ====================================================================
// 4) عرض بيانات الحوافز
// ====================================================================
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

    const json = await res.json();
    headersHw  = json.headers;
    hwafezData = json.data;

    document.getElementById('hwafezSection').classList.remove('hidden');
    const idxHw = {
      code: headersHw.indexOf('رقم الموظف'),
      name: headersHw.indexOf('الاسم'),
      fields: [
        'حجم العمل','اتقان العمل وفعاليته','المهارات القيادية','مهارة الإدارة الذاتية',
        'مهارات التواصل والتفاعل','المبادرة والتطوير الذاتي','الإستقلال والموثوقية',
        'الإلتزام والمسؤولية','نسبة الدوام الفعلي للعامل','السويّة الوظيفيّة',
        'مستوى التأهيل','سنوات الخبرة'
      ].map(h => headersHw.indexOf(h))
    };

    const rows = hwafezData.filter(r => String(r[idxHw.code]).trim() === currentUser);
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

    document.getElementById('hwafezSection').scrollIntoView({ behavior: 'smooth' });
  } catch (e) {
    console.error('❌ showHwafez error:', e);
    alert('حدث خطأ أثناء جلب بيانات الحوافز');
  }
}

// ====================================================================
// 5) إرسال إشعار للمشرف
// ====================================================================
async function sendSupervisorNotification() {
  const title = document.getElementById('notifTitleInput').value.trim();
  const body  = document.getElementById('notifBodyInput').value.trim();
  if (!title || !body) return alert('يرجى إدخال عنوان ونص الإشعار.');

  try {
    const res = await fetch(`${API_BASE}/notify-all`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body:    JSON.stringify({ title, body })
    });
    if (!res.ok) throw new Error(await res.text() || res.status);
    alert('✅ تم إرسال الإشعار لجميع المستخدمين.');
    document.getElementById('notifTitleInput').value = '';
    document.getElementById('notifBodyInput').value  = '';
  } catch (e) {
    console.error('❌ sendSupervisorNotification error:', e);
    alert('❌ خطأ في إرسال الإشعار');
  }
}

// ====================================================================
// 6) تسجيل الخروج
// ====================================================================
function logout() {
  jwtToken    = null;
  currentUser = null;
  localStorage.removeItem('jwtToken');
  ['records','pushSection','hwafezSection'].forEach(id =>
    document.getElementById(id).classList.add('hidden')
  );
  document.getElementById('loginSection').classList.remove('hidden');
}
