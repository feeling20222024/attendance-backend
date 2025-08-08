// notifications.js (محدَّث)
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';
window.serverNotifications = JSON.parse(localStorage.getItem('serverNotifications') || '[]') || [];

function persistNotifications() {
  localStorage.setItem('serverNotifications', JSON.stringify(window.serverNotifications));
}

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
      const timeStr = new Date(n.time || n.timestamp || Date.now()).toLocaleString('ar-EG',{
        dateStyle:'short', timeStyle:'short'
      });
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

window.addNotification = ({ title, body, timestamp }) => {
  const time = timestamp || (new Date()).toISOString();
  const arr = window.serverNotifications || [];
  if (arr[0]?.title === title && arr[0]?.body === body) return;
  arr.unshift({ title, body, time });
  window.serverNotifications = arr.slice(0,50);
  persistNotifications();
  renderNotifications();
};

// جلب سجل الإشعارات من الخادم (بعد تسجيل الدخول)
window.openNotificationLog = async () => {
  // إذا لدينا JWT، نطلب API الشخصي الذي يرجع personal+global
  if (window.jwtToken) {
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${window.jwtToken}` }
      });
      if (res.ok) {
        const { notifications } = await res.json();
        window.serverNotifications = notifications || [];
        persistNotifications();
        renderNotifications();
        return;
      }
    } catch (e) { /* ignore */ }
  }

  // إن فشلنا أو لا يوجد JWT نطلب الإشعارات العامة (قبل الدخول)
  try {
    const res = await fetch(`${API_BASE}/public-notifications`);
    if (res.ok) {
      const { notifications } = await res.json();
      window.serverNotifications = notifications || [];
      persistNotifications();
      renderNotifications();
      return;
    }
  } catch (e) { /* ignore */ }

  // أخيراً، اعرض ما في الـ localStorage
  renderNotifications();
};

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

  // عند التحميل، نعرض ما في localStorage ثم نحاول جلب العام (حتى قبل الدخول)
  renderNotifications();
  openNotificationLog().catch(()=>{});
});
