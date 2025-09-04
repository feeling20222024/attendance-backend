// notifications.js — Part 1 (ضع هذا أولاً)
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';

// مكان تخزين إشعارات الجلسة
window.serverNotifications = window.serverNotifications || [];

// محاول قراءة المخزن المحلي بأمان
(function loadLocal() {
  try {
    const raw = localStorage.getItem('serverNotifications');
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) window.serverNotifications = arr;
    }
  } catch (e) {
    console.warn('notifications: failed to read localStorage', e);
    window.serverNotifications = window.serverNotifications || [];
  }
})();

function persistNotifications() {
  try {
    localStorage.setItem('serverNotifications', JSON.stringify(window.serverNotifications || []));
  } catch (e) { /* ignore */ }
}

// ===== دالة تحويل التوقيت إلى توقيت دمشق بدون ثواني =====
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

// ===== رسم الإشعارات في الـ DOM =====
function renderNotifications() {
  const list  = document.getElementById('notificationsLog');
  const badge = document.getElementById('notifCount');
  const clear = document.getElementById('clearNotifications');
  // إذا لم توجد عناصر DOM، نخرج بهدوء (لا خطأ)
  if (!list || !badge || !clear) return;

  list.innerHTML = '';
  const arr = (window.serverNotifications || []).slice(0,50);
  if (!arr.length) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    badge.classList.add('hidden');
  } else {
    arr.forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-1';
      const timeStr = formatDamascus(n.timestamp || n.time || Date.now());
      li.innerHTML = `<strong>${escapeHtml(String(n.title || ''))}</strong><br>
        <small>${escapeHtml(String(n.body || ''))}</small><br>
        <small class="text-gray-400">${escapeHtml(String(timeStr))}</small>`;
      list.appendChild(li);
    });
    badge.textContent = String(window.serverNotifications.length);
    badge.classList.remove('hidden');
  }

  clear.style.display = (window.currentUser === SUPERVISOR_CODE && window.serverNotifications.length) ? 'block' : 'none';
}

// بسيط لتجنيب XSS عند إدخال النصوص في DOM
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

// ===== إضافة إشعار جديد محليًا وتجنّب التكرار =====
window.addNotification = ({ title, body, timestamp }) => {
  const now = timestamp || Date.now();
  const arr = window.serverNotifications || [];
  if (arr[0]?.title === title && arr[0]?.body === body) return;
  arr.unshift({ title: title || '', body: body || '', timestamp: now });
  if (arr.length > 50) arr.length = 50;
  window.serverNotifications = arr;
  persistNotifications();
  renderNotifications();
};

// ===== جلب سجل الإشعارات من الخادم (عام أو محمي حسب وجود JWT) =====
// ===== جلب سجل الإشعارات (عام أو خاص) =====
window.openNotificationLog = async () => {
  try {
    let url = `${API_BASE}/public-notifications`;
    const opts = { headers: { 'Content-Type': 'application/json' } };

    // لو لدينا JWT، نستخدم endpoint المحمي ونضيف الهيدر
    if (window.jwtToken) {
      url = `${API_BASE}/notifications`;
      opts.headers.Authorization = `Bearer ${window.jwtToken}`;
    }

    const res = await fetch(url, opts);
    if (!res.ok) {
      // لو فشل الطلب المحمي (مثلاً 401) نت fallback للعامة
      if (window.jwtToken && res.status === 401) {
        // حاول جلب العامة بدلًا من ذلك
        const publicRes = await fetch(`${API_BASE}/public-notifications`);
        if (publicRes.ok) {
          const body = await publicRes.json();
          window.serverNotifications = Array.isArray(body.notifications) ? body.notifications : [];
          persistNotifications();
          renderNotifications();
          return;
        }
      }
      // فشل عام — لا نكسر الواجهة، نرسم المحلي
      console.warn('openNotificationLog: fetch failed', res.status);
      renderNotifications();
      return;
    }

    const json = await res.json();
    const notifications = Array.isArray(json.notifications) ? json.notifications : [];

    // normalize: ensure each item has time/timestamp
    window.serverNotifications = notifications.map(n => ({
      title: n.title || '',
      body:  n.body  || '',
      time:  n.time || n.timestamp || Date.now()
    }));

    persistNotifications();
    renderNotifications();
  } catch (err) {
    console.warn('openNotificationLog error:', err);
    // عند الخطأ نعرض المخزن المحلي فقط
    renderNotifications();
  }
};
// notifications.js — Part 2 (ضع هذا بعد Part 1)

// تفعيل أزرار الجرس والعداد ومسح الإشعارات بعد تحميل DOM
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('notificationsPanel');
  const bell  = document.getElementById('notifBell');
  const clear = document.getElementById('clearNotifications');

  if (!bell) return; // لا نكمل إن لم يوجد زر الجرس

  // حماية: إن لم يوجد لوحة أو زر مسح، نكمل عمل الجرس لكن بتصرفات منقوصة
  panel && panel.addEventListener('click', e => e.stopPropagation());

 bell.addEventListener('click', async e => {
    e.stopPropagation();
    const panelWasHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden');
    if (panelWasHidden) {
      // لو فتحنا اللوحة الآن، جلب الإشعارات (سوف يعرض العامة لو لم يسجل المستخدم)
      await openNotificationLog();
    } catch (err) {
      console.warn('bell click: openNotificationLog failed', err);
      // لو فشل الشبك، سيُعرض المخزن المحلي بالفعل عبر renderNotifications داخل openNotificationLog
    }
  });

  // إغلاق عند النقر خارج اللوحة
  document.body.addEventListener('click', () => {
    if (panel) panel.classList.add('hidden');
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
        // نستمر ليتم مسح السجل المحلي حتى إن فشل الطلب للخادم
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
    // لا نعرض أي خطأ للمستخدم هنا — سيتم عرض المخزن المحلي إن وجد
  });
}); // نهاية DOMContentLoaded
