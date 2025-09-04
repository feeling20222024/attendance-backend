// notifications.js
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';
window.serverNotifications = [];

// حاول تحميل ما في localStorage إن وُجد (اختياري)
window.serverNotifications = JSON.parse(localStorage.getItem('serverNotifications') || '[]');
function persistNotifications() {
  localStorage.setItem('serverNotifications', JSON.stringify(window.serverNotifications));
}

// ===== دالة تحويل التوقيت إلى توقيت دمشق بدون ثواني =====
function formatDamascus(timestamp) {
  // تقبل رقم (ملّي) أو ISO-string أو undefined
  const t = (typeof timestamp === 'number') ? timestamp
          : (typeof timestamp === 'string' && /^\d+$/.test(timestamp)) ? Number(timestamp)
          : Date.parse(timestamp) || Date.now();

  const date = new Date(t);

  // حاول استخدام Intl.formatToParts للحصول على أجزاء ثابتة بتوقيت المنطقة
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Damascus',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false
    });
    const parts = fmt.formatToParts(date);
    // اجمع الأجزاء للحصول على YYYY-MM-DD HH:MM
    const map = {};
    parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });
    // بعض المتصفحات قد تعطي day/month/year مختلفة في locale؛ هنا نستخدم names من map
    const Y = map.year || String(date.getUTCFullYear());
    const M = map.month || String(date.getUTCMonth() + 1).padStart(2, '0');
    const D = map.day || String(date.getUTCDate()).padStart(2, '0');
    const H = map.hour || String(date.getUTCHours()).padStart(2, '0');
    const Min = map.minute || String(date.getUTCMinutes()).padStart(2, '0');

    return `${Y}-${M}-${D} ${H}:${Min}`;
  } catch (e) {
    // fallback بسيط: أضف +3 ساعات إلى UTC (إذا لم يوجد دعم timeZone)
    const d = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const H = String(d.getUTCHours()).padStart(2, '0');
    const Min = String(d.getUTCMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${H}:${Min}`;
  }
}

// ===== رسم الإشعارات =====
function renderNotifications() {
  const list  = document.getElementById('notificationsLog');
  const badge = document.getElementById('notifCount');
  const clear = document.getElementById('clearNotifications');
  if (!list || !badge || !clear) return;

  list.innerHTML = '';
  if (!window.serverNotifications.length) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    badge.classList.add('hidden');
  } else {
    window.serverNotifications.slice(0,50).forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-1';
      // استخدم formatDamascus بدون ثواني
      const timeStr = formatDamascus(n.timestamp || n.time || Date.now());
      li.innerHTML = `<strong>${n.title}</strong><br>
        <small>${n.body}</small><br>
        <small class="text-gray-400">${timeStr}</small>`;
      list.appendChild(li);
    });
    badge.textContent = window.serverNotifications.length;
    badge.classList.remove('hidden');
  }

  clear.style.display =
    (window.currentUser === SUPERVISOR_CODE && window.serverNotifications.length)
      ? 'block' : 'none';
}

// ===== إضافة إشعار جديد محليًّا وتجنّب التكرار =====
window.addNotification = ({ title, body, timestamp }) => {
  const now = timestamp || Date.now();
  const arr = window.serverNotifications || [];

  if (arr[0]?.title === title && arr[0]?.body === body) return;

  arr.unshift({ title, body, timestamp: now });
  if (arr.length > 50) arr.pop();

  window.serverNotifications = arr;
  persistNotifications();
  renderNotifications();
};

// ===== جلب سجل الإشعارات من الخادم إذا كان لدينا JWT =====
window.openNotificationLog = async () => {
  if (window.jwtToken) {
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${window.jwtToken}` }
      });
      if (res.ok) {
        const { notifications } = await res.json();
        if (Array.isArray(notifications)) {
          // تأكد من أن الطوابع زمنية موجودة (استخدم الوقت الحالي إن لم يوجد)
          window.serverNotifications = notifications.map(n => ({
            title: n.title,
            body:  n.body,
            timestamp: n.time || n.timestamp || Date.now()
          }));
          persistNotifications();
        }
      }
    } catch (e) { /* ignore */ }
  }
  renderNotifications();
};

// ===== تفعيل زر الجرس والعداد عند DOMContentLoaded =====
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('notificationsPanel');
  const bell  = document.getElementById('notifBell');
  const clear = document.getElementById('clearNotifications');
  if (!panel || !bell) return;

  panel.addEventListener('click', e => e.stopPropagation());
  bell.addEventListener('click', async e => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      await openNotificationLog();
    }
  });
  document.body.addEventListener('click', () => panel.classList.add('hidden'));

  clear.addEventListener('click', async e => {
    e.stopPropagation();
    if (window.currentUser !== SUPERVISOR_CODE) return;
    if (!confirm('هل أنت متأكد من مسح جميع الإشعارات؟')) return;
    await fetch(`${API_BASE}/notifications`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${window.jwtToken}` }
    });
    window.serverNotifications = [];
    persistNotifications();
    renderNotifications();
  });

  // عند التحميل: إن كان لدينا JWT — جلب السجل من الخادم، وإلا عرض المحلي
  // عند التحميل: لا تفعل شيء إذا لم يسجل المستخدم الدخول
if (window.jwtToken && window.currentUser) {
  openNotificationLog();
}
// إذا لم يسجل المستخدم الدخول، لا نفعل شيء، ولا نستدعي renderNotifications
});
