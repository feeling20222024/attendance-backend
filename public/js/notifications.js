// public/js/notifications.js

const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';
window.serverNotifications = []; // دائماً نبدأ بمصفوفة نظيفة

// —————————————————————————————————————————
// 1) رسم الإشعارات
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
    window.serverNotifications.forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-1';
      const timeStr = new Date(n.time || n.timestamp).toLocaleString('ar-EG', {
        dateStyle: 'short', timeStyle: 'short'
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
// 2) جلب سجل الإشعارات من الخادم
// —————————————————————————————————————————
// جلب سجل الإشعارات
window.openNotificationLog = async () => {
  if (window.jwtToken) {  // ← هنا تتحقّق من window.jwtToken
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${window.jwtToken}` }
      });
      if (res.ok) {
        const { notifications } = await res.json();
        window.serverNotifications = notifications;
      }
    } catch { /* ignore */ }
  }
  renderNotifications();
};


// —————————————————————————————————————————
// 3) إضافة إشعار جديد محليّاً (من الفيروسرسوكر أو push)
// —————————————————————————————————————————
window.addNotification = ({ title, body, timestamp, time }) => {
  const t = timestamp || time || Date.now();
  // تجنّب التكرار
  if (window.serverNotifications[0]?.title === title &&
      window.serverNotifications[0]?.body === body) {
    return;
  }
  window.serverNotifications.unshift({ title, body, time: t });
  if (window.serverNotifications.length > 50) {
    window.serverNotifications.pop();
  }
  renderNotifications();
};

// —————————————————————————————————————————
// 4) تعامل مع DOMContentLoaded
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
        headers: { 'Authorization': `Bearer ${window.jwtToken}` }
      });
      window.serverNotifications = [];
      renderNotifications();
    } catch { /* ignore */ }
  });

  // فور التحميل، حاول عرض أي إشعارات حتى لو لم يُسجّل المستخدم
  renderNotifications();
});
