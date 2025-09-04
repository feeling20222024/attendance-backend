// notifications.js (إصدار مصحَّح كامل)
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';
window.serverNotifications = [];

// حاول تحميل ما في localStorage إن وُجد (آمن)
try {
  const saved = localStorage.getItem('serverNotifications');
  window.serverNotifications = saved ? JSON.parse(saved) : [];
} catch (e) {
  window.serverNotifications = [];
}

function persistNotifications() {
  try {
    localStorage.setItem('serverNotifications', JSON.stringify(window.serverNotifications || []));
  } catch (e) { /* ignore */ }
}

// تحويل التوقيت إلى توقيت دمشق بدون ثواني
function formatDamascus(timestamp) {
  const t = (typeof timestamp === 'number') ? timestamp
          : (typeof timestamp === 'string' && /^\d+$/.test(timestamp)) ? Number(timestamp)
          : Date.parse(timestamp) || Date.now();
  const date = new Date(t);
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Damascus',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false
    });
    const parts = fmt.formatToParts(date);
    const map = {};
    parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });
    const Y = map.year || String(date.getUTCFullYear());
    const M = map.month || String(date.getUTCMonth() + 1).padStart(2, '0');
    const D = map.day || String(date.getUTCDate()).padStart(2, '0');
    const H = map.hour || String(date.getUTCHours()).padStart(2, '0');
    const Min = map.minute || String(date.getUTCMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${H}:${Min}`;
  } catch (e) {
    const d = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const H = String(d.getUTCHours()).padStart(2, '0');
    const Min = String(d.getUTCMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${H}:${Min}`;
  }
}

// رسم الإشعارات في الواجهة
function renderNotifications() {
  const list  = document.getElementById('notificationsLog');
  const badge = document.getElementById('notifCount');
  const clear = document.getElementById('clearNotifications');
  if (!list || !badge || !clear) return;

  list.innerHTML = '';
  if (!Array.isArray(window.serverNotifications) || window.serverNotifications.length === 0) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    badge.classList.add('hidden');
  } else {
    window.serverNotifications.slice(0,50).forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-1';
      const timeStr = formatDamascus(n.timestamp || n.time || Date.now());
      li.innerHTML = `<strong>${n.title || ''}</strong><br>
        <small>${n.body || ''}</small><br>
        <small class="text-gray-400">${timeStr}</small>`;
      list.appendChild(li);
    });
    badge.textContent = String(window.serverNotifications.length);
    badge.classList.remove('hidden');
  }

  clear.style.display =
    (String(window.currentUser) === String(SUPERVISOR_CODE) && window.serverNotifications.length)
      ? 'block' : 'none';
}

// إضافة إشعار محليًا مع تجنّب التكرار
window.addNotification = ({ title, body, timestamp }) => {
  const now = timestamp || Date.now();
  const arr = Array.isArray(window.serverNotifications) ? window.serverNotifications : [];
  if (arr[0]?.title === title && arr[0]?.body === body) return;
  arr.unshift({ title: title || '', body: body || '', timestamp: now });
  if (arr.length > 50) arr.length = 50;
  window.serverNotifications = arr;
  persistNotifications();
  renderNotifications();
};

// ===== جلب سجل الإشعارات (عام أو خاص) =====
window.openNotificationLog = async () => {
  try {
    let endpoint, headers = {};

    if (window.jwtToken) {
      // مستخدم مسجل دخول
      endpoint = `${API_BASE}/notifications`;
      headers = { Authorization: `Bearer ${window.jwtToken}` };
    } else {
      // زائر
      endpoint = `${API_BASE}/public-notifications`;
    }

    const res = await fetch(endpoint, { headers, mode: 'cors' });
    if (!res.ok) {
      console.warn('fetch failed', res.status);
      return renderNotifications();
    }

    const body = await res.json();
    const notifications = Array.isArray(body.notifications) ? body.notifications : [];

    // خزّن الإشعارات القادمة من الخادم
    window.serverNotifications = notifications.map(n => ({
      title: n.title || '',
      body: n.body || '',
      timestamp: n.time || n.timestamp || Date.now()
    }));

    // خزنها محلياً
    persistNotifications();
  } catch (e) {
    console.warn('openNotificationLog error', e);
  } finally {
    // عرضها على واجهة المستخدم
    renderNotifications();
  }
};

// ضبط سلوك زر الجرس والعداد عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('notificationsPanel');
  const bell  = document.getElementById('notifBell');
  const clear = document.getElementById('clearNotifications');
  if (!panel || !bell) return;

  panel.addEventListener('click', e => e.stopPropagation());

  bell.addEventListener('click', async e => {
    e.stopPropagation();
    const wasHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (wasHidden) {
      // نطلب الإشعارات (عام/خاص حسب وجود JWT)
      await openNotificationLog();
    }
  });

  document.body.addEventListener('click', () => {
    if (!panel.classList.contains('hidden')) panel.classList.add('hidden');
  });

  // زر المسح (إن وُجد)
  if (clear) {
    clear.addEventListener('click', async e => {
      e.stopPropagation();
      if (window.currentUser !== SUPERVISOR_CODE) {
        alert('غير مسموح لك بمسح الإشعارات.');
        return;
      }
      if (!confirm('هل أنت متأكد من مسح جميع الإشعارات؟')) return;

      try {
        await fetch(`${API_BASE}/notifications`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.jwtToken}`
          }
        });
      } catch (err) {
        console.warn('clear notifications failed', err);
        // نتابع لمسح السجل المحلي حتى إن فشل الطلب
      }

      window.serverNotifications = [];
      persistNotifications();
      renderNotifications();
    });
  }

  // عند تحميل الصفحة: قم بمحاولة جلب إشعارات الخادم فورًا (تعمل قبل تسجيل الدخول أيضاً)
  // هذا يضمن أن الزائر يرى إشعارات عامة في البداية.
  openNotificationLog().catch(err => {
    console.warn('initial openNotificationLog failed', err);
  });
}); // نهاية DOMContentLoaded

