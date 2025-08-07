// public/js/notifications.js

const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';

// —————————————————————————————————————————
// 0) البداية: حمّل الإشعارات من الـ localStorage (إن وُجدت)
// —————————————————————————————————————————
window.serverNotifications = JSON.parse(
  localStorage.getItem('serverNotifications') || '[]'
);

// دالة للحفظ في الـ localStorage
function persistNotifications() {
  localStorage.setItem(
    'serverNotifications',
    JSON.stringify(window.serverNotifications)
  );
}

// —————————————————————————————————————————
// 1) رسم الإشعارات في اللوحة
// —————————————————————————————————————————
function renderNotifications() {
  const list  = document.getElementById('notificationsLog');
  const badge = document.getElementById('notifCount');
  const clear = document.getElementById('clearNotifications');
  if (!list || !badge || !clear) return;

  list.innerHTML = '';
  if (window.serverNotifications.length === 0) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    badge.classList.add('hidden');
  } else {
    window.serverNotifications.slice(0, 50).forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-1';
      const timeStr = new Date(n.timestamp).toLocaleString('ar-EG', {
        dateStyle: 'short',
        timeStyle: 'short'
      });
      li.innerHTML = `
        <strong>${n.title}</strong><br>
        <small>${n.body}</small><br>
        <small class="text-gray-400">${timeStr}</small>
      `;
      list.appendChild(li);
    });
    badge.textContent = window.serverNotifications.length;
    badge.classList.remove('hidden');
  }

  clear.style.display =
    (window.currentUser === SUPERVISOR_CODE && window.serverNotifications.length)
      ? 'block'
      : 'none';
}

// —————————————————————————————————————————
// 2) إضافة إشعار جديد إلى الذاكرة وتجنّب التكرار
// —————————————————————————————————————————
window.addNotification = ({ title, body, timestamp }) => {
  const now = timestamp || Date.now();
  const arr = window.serverNotifications;

  // إذا هو نفس العنوان والنص في أول عنصر، تجاهل
  if (arr[0]?.title === title && arr[0]?.body === body) return;

  arr.unshift({ title, body, timestamp: now });
  if (arr.length > 50) arr.pop();

  window.serverNotifications = arr;
  persistNotifications();
  renderNotifications();
};

// —————————————————————————————————————————
// 3) جلب سجلّ الإشعارات من الخادم (إذا كان المستخدم مسجّلاً)
// —————————————————————————————————————————
window.openNotificationLog = async () => {
  if (window.jwtToken) {
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${window.jwtToken}` }
      });
      if (res.ok) {
        const { notifications } = await res.json();
        window.serverNotifications = notifications || [];
        persistNotifications();
      }
    } catch {
      // نتجاهل أي خطأ في الشبكة
    }
  }
  renderNotifications();
};

// —————————————————————————————————————————
// 4) ربط الأحداث عند تحميل الصفحة
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('notificationsPanel');
  const bell  = document.getElementById('notifBell');
  const clear = document.getElementById('clearNotifications');
  if (!panel || !bell) return;

  // منع الإغلاق عند الضغط داخل اللوحة
  panel.addEventListener('click', e => e.stopPropagation());

  // فتح/إغلاق اللوحة عند الضغط على الأيقونة
  bell.addEventListener('click', async e => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      await openNotificationLog();
    }
  });

  // إغلاق اللوحة عند الضغط في أي مكان آخر
  document.body.addEventListener('click', () => {
    panel.classList.add('hidden');
  });

  // زر مسح جميع الإشعارات (للمشرف فقط)
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

  // عند التحميل: 
  // - إذا المستخدم مسجّل (jwtToken موجود) نحمّل من الخادم
  // - وإن لم يكن مسجّلاً نعرض ما تبقى في localStorage
  if (window.jwtToken) {
    openNotificationLog();
  } else {
    renderNotifications();
  }
});
