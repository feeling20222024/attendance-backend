// notifications.js (مُحدَّث — يعرض الوقت محلياً +3 ساعات)
// --------------------------------------------------------
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';

// —————————————————————————————————————————
// 0) تحميل الإشعارات المُخزَّنة (إن وُجدت) من localStorage
// —————————————————————————————————————————
window.serverNotifications = JSON.parse(
  localStorage.getItem('serverNotifications') || '[]'
);

// دالة لمزامنة التخزين المحلي
function persistNotifications() {
  localStorage.setItem('serverNotifications', JSON.stringify(window.serverNotifications));
}

// —————————————————————————————————————————
// مساعدة: استخراج طابع زمني صالح (millis) من كائن الإشعار
// تدعم الحقول: timestamp (رقم) أو time (ISO string) أو عدم وجودها
// —————————————————————————————————————————
function getTimestampMillis(n) {
  if (!n) return Date.now();
  if (typeof n.timestamp === 'number') return n.timestamp;
  if (typeof n.timestamp === 'string' && !isNaN(Number(n.timestamp))) return Number(n.timestamp);
  if (typeof n.time === 'number') return n.time;
  if (typeof n.time === 'string') {
    const parsed = Date.parse(n.time);
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now();
}

// —————————————————————————————————————————
// دالة تنسيق الوقت: تضيف +3 ساعات (3 * 3600000 ms) ثم تعرض بالتنسيق العربي
// —————————————————————————————————————————
function formatTimestampWithGMTplus3(tsMillis) {
  const ms = Number(tsMillis) || Date.now();
  // أضف 3 ساعات (بالملّي)
  const adjusted = new Date(ms + 3 * 60 * 60 * 1000);
  // تنسيق عربي مختصر (تاريخ + وقت)
  try {
    return adjusted.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' });
  } catch (e) {
    // fallback بسيط
    return adjusted.toLocaleString();
  }
}

// —————————————————————————————————————————
// 1) رسم الإشعارات
// —————————————————————————————————————————
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
      const millis = getTimestampMillis(n);
      const timeStr = formatTimestampWithGMTplus3(millis);
      li.innerHTML = `<strong>${escapeHtml(n.title)}</strong><br>
        <small>${escapeHtml(n.body)}</small><br>
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

// مساعدة صغيرة لتجنّب XSS لو أن العناوين تأتي من مصدر خارجي
function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// —————————————————————————————————————————
// 2) إضافة إشعار جديد محليًّا وتجنّب التكرار
// يخزن الطابع الزمني كـ millis (رقمي)
// —————————————————————————————————————————
window.addNotification = ({ title, body, timestamp, time }) => {
  const now = getTimestampMillis({ timestamp, time });
  const arr = window.serverNotifications || [];

  // تجاهل التكرار الواضح
  if (arr[0]?.title === title && arr[0]?.body === body) return;

  arr.unshift({ title, body, timestamp: now });
  if (arr.length > 50) arr.pop();

  window.serverNotifications = arr;
  persistNotifications();
  renderNotifications();
};

// —————————————————————————————————————————
// 3) جلب سجل الإشعارات من الخادم
// إذا كان المستخدم مُسجَّلاً (jwtToken) نجلب السجل المُوَحَّد من الخادم
// وإلا يمكننا جلب الإشعارات العامة من endpoint عام (optional)
// —————————————————————————————————————————
window.openNotificationLog = async () => {
  // إذا لدينا توكن تسجيل دخول، جلب سجل المستخدم المصادق
  if (window.jwtToken) {
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${window.jwtToken}` }
      });
      if (res.ok) {
        const { notifications } = await res.json();
        // نتوقع أن الخادم يرسل مصفوفة عناصر فيها title, body, time (ISO) أو timestamp
        // لنحوّل كل عنصر إلى شكل يحتوي على numeric timestamp
        window.serverNotifications = (notifications || []).map(n => {
          const t = getTimestampMillis(n);
          return { title: n.title, body: n.body, timestamp: t };
        }).slice(0,50);
        persistNotifications();
      } else {
        // في حال استجابة غير OK: لا نكسر العرض المحلي
        console.warn('openNotificationLog: server returned', res.status);
      }
    } catch (err) {
      console.warn('openNotificationLog fetch failed', err);
      // تجاهل الخطأ، اعرض ما في localStorage
    }
  } else {
    // خيار: إذا أردت عرض الإشعارات العامة قبل الدخول
    try {
      const res = await fetch(`${API_BASE}/public-notifications`);
      if (res.ok) {
        const { notifications } = await res.json();
        window.serverNotifications = (notifications || []).map(n => {
          const t = getTimestampMillis(n);
          return { title: n.title, body: n.body, timestamp: t };
        }).slice(0,50);
        persistNotifications();
      }
    } catch (e) {
      // لا مشكلة: استمر بعرض المحلي
    }
  }

  renderNotifications();
};

// —————————————————————————————————————————
// 4) DOM ready: ربط زر الجرس وعمليات المسح
// —————————————————————————————————————————
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
    try {
      await fetch(`${API_BASE}/notifications`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${window.jwtToken}` }
      });
      window.serverNotifications = [];
      persistNotifications();
      renderNotifications();
    } catch (err) {
      console.error('Failed to clear notifications', err);
      alert('حدث خطأ أثناء مسح الإشعارات.');
    }
  });

  // عند التحميل: إذا لدينا jwtToken نجيب السجل من الخادم وإلا نعرض ما بخزن المحلي
  if (window.jwtToken) {
    openNotificationLog();
  } else {
    renderNotifications();
  }
});
