// public/js/app.web.js

// —————————————————————————————————————————
// 1) إعداد Firebase (احتفظ بالقيم كما في firebase-messaging-sw.js)
// —————————————————————————————————————————
firebase.initializeApp({
  apiKey:    "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:"device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket:"device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:     "1:235398312189:web:8febe5e63f7b134b808e94"
});

// نقاط النهاية والخادم
const API_BASE       = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT = `${API_BASE}/login`;
let jwtToken = null, currentUser = null;

// —————————————————————————————————————————
// 2) initPush: تهيئة إشعارات الويب عبر FCM+SW
// —————————————————————————————————————————
window.initPush = async () => {
  if (!('serviceWorker' in navigator) || !firebase.messaging) return;
  
  // 2.1) تسجيل Service Worker الخاصّ بـ FCM
  const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
  console.log('✅ Firebase SW registered:', reg.scope);

  // 2.2) إنشاء مثيل messaging
  const messaging = firebase.messaging();

  // 2.3) طلب إذن الإشعارات
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('❌ المستخدم لم يمنح إذن الإشعارات');
    return;
  }

  // 2.4) جلب FCM token
  const token = await messaging.getToken({
    vapidKey: "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ",
    serviceWorkerRegistration: reg
  });
  console.log('✅ FCM token (web):', token);

  // 2.5) تسجيل التوكن في الخادم
  await fetch(`${API_BASE}/register-token`, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify({ user: currentUser, token })
  });
  console.log('✅ تم تسجيل توكن FCM بنجاح على الخادم');

  // 2.6) استقبال الرسائل أثناء التواجد في الواجهة
  messaging.onMessage(payload => {
    console.log('📩 foreground message:', payload);
    const { title, body } = payload.notification || {};
    if (title) new Notification(title, { body });
  });
};

// —————————————————————————————————————————
// 3) دالة تسجيل الدخول (ويب)
// —————————————————————————————————————————
async function loginWeb() {
  const code = document.getElementById('codeInput').value.trim();
  const pass = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) {
    alert('يرجى إدخال الكود وكلمة المرور.');
    return;
  }

  // مصادقة
  const res = await fetch(LOGIN_ENDPOINT, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body: JSON.stringify({ code, pass })
  });
  if (res.status === 401) {
    alert('بيانات الدخول خاطئة');
    return;
  }
  if (!res.ok) {
    throw new Error(`خطأ بالخادم (${res.status})`);
  }

  const { token, user } = await res.json();
  jwtToken = token;
  localStorage.setItem('jwtToken', token);

  currentUser = user.code ?? user['كود الموظف'];
  window.currentUser = currentUser;
  console.log('✅ loginWeb successful, currentUser =', currentUser);

  // تهيئة إشعارات الويب
  await window.initPush();

  // عرض البيانات
  await fetchAndRenderWeb();
}

// —————————————————————————————————————————
// 4) دالة جلب وعرض البيانات (ويب)
// —————————————————————————————————————————
async function fetchAndRenderWeb() {
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

  // خزن البيانات وعرض الواجهة
  renderAttendance(aJson.headers, aJson.data, meJson.user['كود الموظف']);
  renderHwafez(hwJson.headers, hwJson.data);
}

// —————————————————————————————————————————
// —————————————————————————————————————————
// 5) رسم جدول الحضور (ويب)
// —————————————————————————————————————————
function renderAttendance(headers, data, userCode) {
  // إظهار واجهة السجلات
  document.getElementById('loginSection').hidden = true;
  document.getElementById('records').hidden      = false;
  document.getElementById('welcomeMsg').textContent = `مرحباً ${userCode}`;

+ // إذا كان المشرف، أظهر قسم الإشعارات ورتّب حدث الضغط على الزر
+ if (String(userCode) === '35190') {
+   const pushSec = document.getElementById('pushSection');
+   pushSec.hidden = false;
+   document.getElementById('sendPushBtn').onclick = async () => {
+     const title = document.getElementById('notifTitleInput').value.trim();
+     const body  = document.getElementById('notifBodyInput').value.trim();
+     if (!title || !body) return alert('يرجى إدخال عنوان ونص الإشعار.');
+     // أرسل الإشعار للمشرف
+     const res = await fetch(`${API_BASE}/notify-all`, {
+       method: 'POST',
+       headers: {
+         'Content-Type':'application/json',
+         'Authorization':`Bearer ${jwtToken}`
+       },
+       body: JSON.stringify({ title, body })
+     });
+     if (res.ok) alert('✅ تم إرسال الإشعار');
+     else {
+       const err = await res.text();
+       alert('❌ خطأ في الإرسال: ' + err);
+     }
+   };
+ } else {
+   document.getElementById('pushSection').hidden = true;
+ }
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
  data
    .filter(r => String(r[idx.code]||'').trim() === String(userCode))
    .forEach(r => {
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
        <td class="border px-4 py-2">${r[idx.adminC]||''}</td>
        <td class="border px-4 py-2">${r[idx.adminR]||''}</td>
        <td class="border px-4 py-2">${r[idx.adminDue]||''}</td>
      `;
      tbody.appendChild(tr);
    });
}

// —————————————————————————————————————————
// 6) رسم جدول الحوافز (ويب)
// —————————————————————————————————————————
function renderHwafez(headers, data) {
  const idx = {
    code: headers.indexOf('رقم الموظف'),
    name: headers.indexOf('الاسم'),
    work: headers.indexOf('حجم العمل'),
    mastery: headers.indexOf('اتقان العمل وفعاليته'),
    leadership: headers.indexOf('المهارات القيادية'),
    self: headers.indexOf('مهارة الإدارة الذاتية'),
    comms: headers.indexOf('مهارات التواصل والتفاعل'),
    initiative: headers.indexOf('المبادرة والتطوير الذاتي'),
    independence: headers.indexOf('الإستقلال والموثوقية'),
    responsibility: headers.indexOf('الإلتزام والمسؤولية'),
    attendancePct: headers.indexOf('نسبة الدوام الفعلي للعامل'),
    balance: headers.indexOf('السويّة الوظيفيّة'),
    qualification: headers.indexOf('مستوى التأهيل'),
    experience: headers.indexOf('سنوات الخبرة'),
  };
  const tbody = document.getElementById('hwafezBody');
  tbody.innerHTML = '';
  const userCode = window.currentUser;
  data.filter(r=>String(r[idx.code]).trim()===String(userCode))
      .forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="border px-4 py-2">${r[idx.code]||''}</td>
          <td class="border px-4 py-2">${r[idx.name]||''}</td>
          <td class="border px-4 py-2">${r[idx.work]||''}</td>
          <td class="border px-4 py-2">${r[idx.mastery]||''}</td>
          <td class="border px-4 py-2">${r[idx.leadership]||''}</td>
          <td class="border px-4 py-2">${r[idx.self]||''}</td>
          <td class="border px-4 py-2">${r[idx.comms]||''}</td>
          <td class="border px-4 py-2">${r[idx.initiative]||''}</td>
          <td class="border px-4 py-2">${r[idx.independence]||''}</td>
          <td class="border px-4 py-2">${r[idx.responsibility]||''}</td>
          <td class="border px-4 py-2">${r[idx.attendancePct]||''}</td>
          <td class="border px-4 py-2">${r[idx.balance]||''}</td>
          <td class="border px-4 py-2">${r[idx.qualification]||''}</td>
          <td class="border px-4 py-2">${r[idx.experience]||''}</td>
        `;
        tbody.appendChild(tr);
      });
}

// —————————————————————————————————————————
// 7) ربط الزر وأسلوب الخروج
// —————————————————————————————————————————
document.getElementById('loginBtn').onclick  = loginWeb;
document.getElementById('logoutBtn').onclick = () => {
  localStorage.removeItem('jwtToken');
  document.getElementById('records').hidden = true;
  document.getElementById('loginSection').hidden = false;
};
