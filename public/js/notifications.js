const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';
window.serverNotifications = [];

// حفظ الإشعارات محليًا
function persistNotifications() {
  try {
    localStorage.setItem('serverNotifications', JSON.stringify(window.serverNotifications));
  } catch(e){}
}

// عرض الإشعارات في الواجهة
function renderNotifications() {
  const list  = document.getElementById('notificationsLog');
  const badge = document.getElementById('notifCount');
  const clear = document.getElementById('clearNotifications');
  if (!list || !badge) return;

list.innerHTML = '';

if (!window.serverNotifications.length) {
  if (!window.jwtToken) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
  }
  badge.classList.add('hidden');
} else {
  // ✅ مصفاة لمنع التكرار (العنوان + النص)
  const seen = new Set();
  const filtered = window.serverNotifications.filter(n => {
    const key = (n.title || '') + '|' + (n.body || '');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  filtered.forEach(n => {
    const li = document.createElement('li');
    li.className = 'mb-2 border-b pb-1';
    const timeStr = formatDamascus(n.timestamp || n.time || Date.now());
li.innerHTML = `<strong>${n.title || ''}</strong><br>
                <small>${n.body || ''}</small><br>
                <em class="text-gray-400 text-xs">${timeStr}</em>`;

    list.appendChild(li);
  });

  badge.textContent = String(filtered.length);
  badge.classList.remove('hidden');
}
  // زر المسح يظهر فقط للمشرف
  if (clear) {
    clear.style.display =
      (String(window.currentUser) === String(SUPERVISOR_CODE) && window.serverNotifications.length)
      ? 'block' : 'none';
  }
}

// جلب الإشعارات العامة (قبل تسجيل الدخول)
async function fetchPublicNotifications() {
  try {
    const res = await fetch(`${API_BASE}/public-notifications`);
    if (!res.ok) throw new Error('فشل جلب الإشعارات العامة');
    const data = await res.json();
    window.serverNotifications = data.notifications || [];
    persistNotifications();
    renderNotifications();
  } catch(e) {
    console.warn('fetchPublicNotifications failed', e);
    renderNotifications();
  }
}

// جلب إشعارات المستخدم بعد تسجيل الدخول
async function openNotificationLog() {
  if (!window.jwtToken) return; // لا نفعل شيئاً إذا لا يوجد JWT

  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${window.jwtToken}` },
      mode: 'cors'
    });
    if (!res.ok) return;

    const data = await res.json();
    window.serverNotifications = data.notifications || [];
    persistNotifications();
  } catch(e) {
    console.warn('openNotificationLog failed', e);
  } finally {
    renderNotifications();
  }
}

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  const bell = document.getElementById('notifBell');
  const panel = document.getElementById('notificationsPanel');
  const clear = document.getElementById('clearNotifications');

  // جلب إشعارات عامة فور التحميل
  fetchPublicNotifications();

  if (bell && panel) {
    bell.addEventListener('click', async e => {
      e.stopPropagation();
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden') && window.jwtToken) {
        await openNotificationLog();
      }
    });

    document.body.addEventListener('click', () => {
      if (!panel.classList.contains('hidden')) panel.classList.add('hidden');
    });
  }

  // زر المسح
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
      }

      window.serverNotifications = [];
      // تنسيق التاريخ والوقت بتوقيت دمشق
function formatDamascus(ts) {
  const t = (typeof ts === 'number') ? ts
          : (typeof ts === 'string' && /^\d+$/.test(ts)) ? Number(ts)
          : (typeof ts === 'string') ? Date.parse(ts) : NaN;

  const date = isNaN(t) ? new Date() : new Date(t);

  // توقيت دمشق = UTC+3
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const dam = new Date(utc + 3 * 3600 * 1000);

  const Y = dam.getFullYear();
  const M = String(dam.getMonth() + 1).padStart(2, '0');
  const D = String(dam.getDate()).padStart(2, '0');
  const H = String(dam.getHours()).padStart(2, '0');
  const Min = String(dam.getMinutes()).padStart(2, '0');

  return `${Y}-${M}-${D} ${H}:${Min}`;
}

      persistNotifications();
      renderNotifications();
    });
  }
});
