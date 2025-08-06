// notifications.js

const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';

window.serverNotifications = [];

function renderNotifications() {
  const list  = document.getElementById('notificationsLog');
  const badge = document.getElementById('notifCount');
  const clear = document.getElementById('clearNotifications');
  if (!list || !badge || !clear) return;

  list.innerHTML = '';
  const arr = window.serverNotifications;
  if (!arr.length) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    badge.classList.add('hidden');
  } else {
    arr.slice(0,50).forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-1';
      const timeStr = new Date(n.timestamp).toLocaleString('ar-EG', {
        dateStyle: 'short', timeStyle: 'short'
      });
      li.innerHTML = `<strong>${n.title}</strong><br>
                      <small>${n.body}</small><br>
                      <small class="text-gray-400">${timeStr}</small>`;
      list.appendChild(li);
    });
    badge.textContent = arr.length;
    badge.classList.remove('hidden');
  }

  clear.style.display = (window.currentUser===SUPERVISOR_CODE && arr.length)
                         ? 'block' : 'none';
}

window.addNotification = ({ title, body, timestamp }) => {
  const now = timestamp||Date.now();
  const arr = window.serverNotifications;
  if (arr[0]?.title===title && arr[0]?.body===body) return;
  arr.unshift({ title, body, timestamp: now });
  window.serverNotifications = arr.slice(0,50);
  renderNotifications();
};

window.openNotificationLog = async () => {
  // تخلّ عن شرط jwtToken — فقط حاول جلب من الخادم إذا متوفر
  if (window.jwtToken) {
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers:{ Authorization:`Bearer ${window.jwtToken}` }
      });
      if (res.ok) {
        const { notifications } = await res.json();
        window.serverNotifications = notifications;
      }
    } catch {
      // فشل جلب الخادم: اترك local
    }
  }
  renderNotifications();
};

document.addEventListener('DOMContentLoaded', () => {
  const panel  = document.getElementById('notificationsPanel');
  const bell   = document.getElementById('notifBell');
  const clear  = document.getElementById('clearNotifications');

  if (!panel || !bell) return;

  // منع الإغلاق عند النقر داخل اللوحة
  panel.addEventListener('click', e => e.stopPropagation());

  bell.addEventListener('click', async e => {
    e.stopPropagation();
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      await openNotificationLog();
    }
  });

  // إغلاق عند النقر خارجياً
  document.addEventListener('click', () => {
    panel.classList.add('hidden');
  });

  clear.addEventListener('click', async e => {
    e.stopPropagation();
    if (window.currentUser!==SUPERVISOR_CODE) return;
    if (!confirm('هل أنت متأكد من مسح جميع الإشعارات؟')) return;
    await fetch(`${API_BASE}/notifications`, {
      method:'DELETE',
      headers:{ 'Authorization':`Bearer ${window.jwtToken}` }
    });
    window.serverNotifications = [];
    renderNotifications();
  });

  // عرض العداد في البداية
  renderNotifications();
});
