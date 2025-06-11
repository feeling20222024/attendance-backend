// public/js/app.web.js

// —————————————————————————————————————————
// 1) إعداد Firebase (مطابق لفirebase-messaging-sw.js)
// —————————————————————————————————————————
firebase.initializeApp({
  apiKey:    "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:"device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket:"device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:     "1:235398312189:web:8febe5e63f7b134b808e94"
});

// —————————————————————————————————————————
// 2) المتغيرات العامة ونقاط النهاية
// —————————————————————————————————————————
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT  = `${API_BASE}/login`;
const SUPERVISOR_CODE = '35190';
let jwtToken  = null, currentUser = null;

// —————————————————————————————————————————
// 3) initPush: تهيئة إشعارات الويب عبر FCM + SW
// —————————————————————————————————————————
window.initPush = async () => {
  if (!('serviceWorker' in navigator) || !firebase.messaging) return;

  // 3.1) انتظر أي SW فعّال
  const reg = await navigator.serviceWorker.ready;
  console.log('✅ Using active Service Worker at', reg.scope);

  // 3.2) احصل على كائن messaging
  const messaging = firebase.messaging();

  // 3.3) طلب إذن الإشعارات
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('❌ إذن الإشعارات مرفوض');
    return;
  }

  // 3.4) جلب FCM token
  const token = await messaging.getToken({
    vapidKey: "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1l8go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ",
    serviceWorkerRegistration: reg
  });
  console.log('✅ FCM token (web):', token);

  // 3.5) سجلّ التوكن في الخادم
  await fetch(`${API_BASE}/register-token`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ user: currentUser, token })
  });
  console.log('✅ تم تسجيل التوكن على الخادم');

  // 3.6) استمع للرسائل أثناء التواجد في الواجهة
  messaging.onMessage(payload => {
    console.log('📩 foreground message:', payload);
    const { title, body } = payload.notification || {};
    if (title) new Notification(title, { body });
  });
};

// —————————————————————————————————————————
// 4) Helper: تطبيع أرقام عربية → غربية
// —————————————————————————————————————————
function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

// —————————————————————————————————————————
// 5) تسجيل الدخول (ويب فقط)
// —————————————————————————————————————————
async function loginWeb() {
  const code = normalizeDigits(document.getElementById('codeInput').value.trim());
  const pass = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) {
    return alert('يرجى إدخال الكود وكلمة المرور.');
  }

  // 5.1) طلب المصادقة
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

  // 5.2) استلام الـ JWT والـ user
  const { token, user } = await res.json();
  jwtToken = token;
  localStorage.setItem('jwtToken', token);

  currentUser = user.code ?? user['كود الموظف'];
  window.currentUser = currentUser;
  console.log('✅ loginWeb successful, currentUser =', currentUser);

  // 5.3) تهيئة إشعارات الويب
  await window.initPush();

  // 5.4) جلب وعرض البيانات
  await fetchAndRenderWeb();
}

// —————————————————————————————————————————
// 6) جلب وعرض البيانات (ويب فقط)
// —————————————————————————————————————————
async function fetchAndRenderWeb() {
  if (!jwtToken) return;

  // مهم: أضف هيدر الـ Authorization
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

  renderAttendance(aJson.headers, aJson.data, meJson.user['كود الموظف']);
  renderHwafez     (hwJson.headers, hwJson.data);
}

// —————————————————————————————————————————
// 7) رسم جدول الحضور (ويب)
// —————————————————————————————————————————
function renderAttendance(headers, data, userCode) {
  document.getElementById('loginSection').hidden  = true;
  document.getElementById('records').hidden       = false;
  document.getElementById('welcomeMsg').textContent = `مرحباً ${userCode}`;

  if (String(userCode) === SUPERVISOR_CODE) {
    document.getElementById('pushSection').hidden = false;
    document.getElementById('sendPushBtn').onclick = async () => {
      const title = document.getElementById('notifTitleInput').value.trim();
      const body  = document.getElementById('notifBodyInput').value.trim();
      if (!title || !body) return alert('يرجى إدخال عنوان ونص الإشعار.');
      const res2 = await fetch(`${API_BASE}/notify-all`, {
        method: 'POST',
        headers: {
          'Content-Type':'application/json',
          'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ title, body })
      });
      if (res2.ok)  alert('✅ تم إرسال الإشعار');
      else { const e = await res2.text(); alert('❌ خطأ في الإرسال: '+e); }
    };
  }

  const idx = {
    code:     headers.indexOf('رقم الموظف'),
    name:     headers.indexOf('الاسم'),
    status:   headers.indexOf('الحالة'),
    date:     headers.indexOf('التاريخ'),
    in:       headers.indexOf('دخول'),
    out:      headers.indexOf('خروج'),
    sFrom:    headers.indexOf('ساعية (من الساعة)'),
    sTo:      headers.indexOf('ساعية (إلى الساعة)'),
    mFrom:    headers.indexOf('مهمة (من الساعة)'),
    mTo:      headers.indexOf('مهمة (إلى الساعة)'),
    days:     headers.indexOf('عدد الأيام المحتسبة بتقرير الساعيات أو التأخر أقل من ساعة'),
    notes:    headers.indexOf('ملاحظات'),
    adminC:   headers.indexOf('عدد الإجازات الإدارية المحتسبة للعامل'),
    adminR:   headers.indexOf('عدد الإجازات الإدارية المتبقية للعامل'),
    adminDue: headers.indexOf('عدد الإجازات الإدارية المستحقة للعامل')
  };

  const tbody = document.getElementById('attendanceBody');
  tbody.innerHTML = '';
  data.filter(r=>String(r[idx.code]||'').trim()===String(userCode))
      .forEach(r=>{
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="border px-4 py-2">${r[idx.code]  ||''}</td>
          <td class="border px-4 py-2">${r[idx.name]  ||''}</td>
          <td class="border px-4 py-2">${caseMapping[String(r[idx.status]).trim()]||''}</td>
          <td class="border px-4 py-2">${r[idx.date]  ||''}</td>
          <td class="border px-4 py-2">${r[idx.in]    ||''}</td>
          <td class="border px-4 py-2">${r[idx.out]   ||''}</td>
          <td class="border px-4 py-2">${r[idx.sFrom] ||''}</td>
          <td class="border px-4 py-2">${r[idx.sTo]   ||''}</td>
          <td class="border px-4 py-2">${r[idx.mFrom] ||''}</td>
          <td class="border px-4 py-2">${r[idx.mTo]   ||''}</td>
          <td class="border px-4 py-2">${r[idx.days]  ||''}</td>
          <td class="border px-4 py-2">${r[idx.notes] ||''}</td>
          <td class="border px-4 py-2">${r[idx.adminC]||''}</td>
          <td class="border px-4 py-2">${r[idx.adminR]||''}</td>
          <td class="border px-4 py-2">${r[idx.adminDue]||''}</td>
        `;
        tbody.appendChild(tr);
      });
}

// —————————————————————————————————————————
// 8) رسم جدول الحوافز (ويب)
// —————————————————————————————————————————
function renderHwafez(headers, data) {
  const idx = {
    code:         headers.indexOf('رقم الموظف'),
    name:         headers.indexOf('الاسم'),
    work:         headers.indexOf('حجم العمل'),
    mastery:      headers.indexOf('اتقان العمل وفعاليته'),
    leadership:   headers.indexOf('المهارات القيادية'),
    self:         headers.indexOf('مهارة الإدارة الذاتية'),
    comms:        headers.indexOf('مهارات التواصل والتفاعل'),
    initiative:   headers.indexOf('المبادرة والتطوير الذاتي'),
    independence: headers.indexOf('الإستقلال والموثوقية'),
    responsibility: headers.indexOf('الإلتزام والمسؤولية'),
    attendancePct:  headers.indexOf('نسبة الدوام الفعلي للعامل'),
    balance:        headers.indexOf('السويّة الوظيفيّة'),
    qualification:  headers.indexOf('مستوى التأهيل'),
    experience:     headers.indexOf('سنوات الخبرة')
  };
  const tbody = document.getElementById('hwafezBody');
  tbody.innerHTML = '';
  data.filter(r=>String(r[idx.code]).trim()===String(currentUser))
      .forEach(r=>{
        const tr=document.createElement('tr');
        tr.innerHTML=`
        <td class="border px-4 py-2">${r[idx.code]         || ''}</td>
          <td class="border px-4 py-2">${r[idx.name]         || ''}</td>
          <td class="border px-4 py-2">${r[idx.work]         || ''}</td>
          <td class="border px-4 py-2">${r[idx.mastery]      || ''}</td>
          <td class="border px-4 py-2">${r[idx.leadership]   || ''}</td>
          <td class="border px-4 py-2">${r[idx.self]         || ''}</td>
          <td class="border px-4 py-2">${r[idx.comms]        || ''}</td>
          <td class="border px-4 py-2">${r[idx.initiative]   || ''}</td>
          <td class="border px-4 py-2">${r[idx.independence] || ''}</td>
          <td class="border px-4 py-2">${r[idx.responsibility] || ''}</td>
          <td class="border px-4 py-2">${r[idx.attendancePct]  || ''}</td>
          <td class="border px-4 py-2">${r[idx.balance]        || ''}</td>
          <td class="border px-4 py-2">${r[idx.qualification]  || ''}</td>
          <td class="border px-4 py-2">${r[idx.experience]     || ''}</td>
        `;
        tbody.appendChild(tr);
           });
}
