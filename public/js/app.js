// public/js/app.js

// —————————————————————————————————————————
// 0) ثوابت التخزين ونقاط النهاية
// —————————————————————————————————————————
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT  = `${API_BASE}/login`;
const SAVE_NOTIF      = `${API_BASE}/save-notification`;
const LOAD_NOTIFS     = `${API_BASE}/notifications`;
const STORAGE_KEY     = 'notificationsLog';
const SUPERVISOR_CODE = '35190';

let currentUser = null;
let jwtToken    = null;

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
      li.className = 'mb-2 border-b pb-1';
      li.innerHTML = `
        <strong>${n.title}</strong><br>
        ${n.body}<br>
        <small class="text-gray-400">${n.time}</small>
      `;
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
// جلب إشعارات المستخدم من السيرفر وتخزينها محلياً
// —————————————————————————————————————————
async function loadNotificationsFromServer() {
  if (!currentUser || !jwtToken) return;
  try {
    const res = await fetch(`${LOAD_NOTIFS}/${currentUser}`, {
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${jwtToken}`
      }
    });
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const arr = await res.json();
    if (Array.isArray(arr)) {
      saveNotificationsLocal(arr);
      renderNotifications();
      updateBellCount();
    }
  } catch (e) {
    console.warn('❌ لم يتم جلب إشعارات الخادم:', e);
  }
}

// —————————————————————————————————————————
// إضافة إشعار يُستدعى من SW أو push.js
// —————————————————————————————————————————
window.addNotification = async function({ title, body, time }) {
  // 1) حفظ محلي
  const arr = loadNotificationsLocal();
  arr.unshift({ title, body, time });
  if (arr.length > 50) arr.pop();
  saveNotificationsLocal(arr);

  // 2) حفظ في السيرفر (اختياري)
  if (currentUser && jwtToken) {
    fetch(SAVE_NOTIF, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${jwtToken}`
      },
      body: JSON.stringify({ user: currentUser, title, body, time })
    }).catch(e => console.warn('❌ save-notif failed:', e));
  }

  renderNotifications();
  updateBellCount();
};

// —————————————————————————————————————————
// DOMContentLoaded: ربط الأزرار واسترجاع الإشعارات
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').onclick          = login;
  document.getElementById('logoutBtn').onclick         = logout;
  document.getElementById('aboutBtn').onclick          = () => alert('تطبيق متابعة الدوام');
  document.getElementById('hwafezBtn').onclick         = showHwafez;
  document.getElementById('tqeemBtn').onclick          = showTqeem;
  document.getElementById('clearNotifications').onclick = clearNotifications;

  // عرض الإشعارات المحلّية فور التحميل
  renderNotifications();
  updateBellCount();

  // إذا كان هناك JWT محفوظ
  const saved = localStorage.getItem('jwtToken');
  if (saved) {
    jwtToken = saved;
    loginSuccessFlow();
  }
});

// —————————————————————————————————————————
// تسجيل الدخول
// —————————————————————————————————————————
async function login() {
  const code = normalizeDigits(document.getElementById('codeInput').value.trim());
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
    if (res.status === 401) return alert('بيانات الدخول خاطئة.');
    if (!res.ok) throw new Error(`Status ${res.status}`);

    const loginResponse = await res.json();
    jwtToken    = loginResponse.token;
    currentUser = loginResponse.user.code
                ?? loginResponse.user['كود الموظف'];
    window.currentUser = currentUser;
    localStorage.setItem('jwtToken', jwtToken);

    await loginSuccessFlow();
  } catch (e) {
    console.error('❌ login error:', e);
    alert('حدث خطأ أثناء تسجيل الدخول: ' + e.message);
  }
}

// —————————————————————————————————————————
// إجراءات بعد تسجيل الدخول الناجح
// —————————————————————————————————————————
async function loginSuccessFlow() {
  // إظهار الواجهة
  document.getElementById('loginSection').classList.add('hidden');
  document.getElementById('records').classList.remove('hidden');
  document.getElementById('welcomeMsg').textContent = `مرحباً ${currentUser}`;
  if (currentUser === SUPERVISOR_CODE) {
    document.getElementById('pushSection').classList.remove('hidden');
    document.getElementById('sendPushBtn').onclick = sendSupervisorNotification;
  }
  // جلب وعرض البيانات
  await fetchAndRender();
  // تهيئة إشعارات الويب (SW + FCM) إن وُجدت
  if (typeof window.initNotifications === 'function') {
    window.initNotifications();
  }
  // جلب سجل الإشعارات الموحد من الخادم
  await loadNotificationsFromServer();
}

// —————————————————————————————————————————
// تسجيل الخروج
// —————————————————————————————————————————
function logout() {
  currentUser = null;
  jwtToken    = null;
  localStorage.removeItem('jwtToken');
  document.getElementById('loginSection').classList.remove('hidden');
  ['records','pushSection','hwafezSection','tqeemSection']
    .forEach(id => document.getElementById(id).classList.add('hidden'));
}

// … بقية دوال عرض البيانات (fetchAndRender, showHwafez, showTqeem) كما كانت لديك سابقاً.
