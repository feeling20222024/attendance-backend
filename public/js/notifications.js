// notifications.js — تحديث وتحسين واجهة سجل الإشعارات

const panel = document.getElementById('notificationsPanel');
const list = document.getElementById('notificationsList');
const badge = document.getElementById('notifBadge');
const bell = document.getElementById('notifBell');
const clearButton = document.getElementById('clearNotifications');

window.serverNotifications = [];


  function renderNotifications() {
  const list     = document.getElementById('notificationsLog');
  const count    = document.getElementById('notifCount');
  const clearBtn = document.getElementById('clearNotifications');
  if (!list || !count || !clearBtn) return; // ← تأكد من وجودها

  const arr = window.serverNotifications || [];
  // ... بقية المنطق
}

  const maxToShow = 50;
  const items = window.serverNotifications.slice(0, maxToShow);

  for (const n of items) {
    const li = document.createElement('li');
    li.className = 'notification-item';

    const date = new Date(n.timestamp);
    const timeStr = date.toLocaleString('ar-EG', {
      dateStyle: 'short',
      timeStyle: 'short',
    });

    li.innerHTML = `
      <div class="notif-title">${n.title || '(بدون عنوان)'}</div>
      <div class="notif-body">${n.body || ''}</div>
      <div class="notif-time">${timeStr}</div>
    `;

    list.appendChild(li);
  }

  badge.classList.remove('hidden');
  badge.textContent = items.length;
}

window.addNotification = ({ title, body, timestamp }) => {
  const now = timestamp || Date.now();

  window.serverNotifications.unshift({ title, body, timestamp: now });

  // الاحتفاظ بآخر 50 إشعار فقط
  window.serverNotifications = window.serverNotifications.slice(0, 50);
  renderNotifications();
};

window.openNotificationLog = async () => {
  if (!window.jwtToken) return;

  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { Authorization: `Bearer ${window.jwtToken}` },
    });

    if (!res.ok) throw new Error('فشل التحميل');

    const json = await res.json();
    window.serverNotifications = json.notifications || [];
    renderNotifications();
  } catch (err) {
    console.error('فشل تحميل الإشعارات:', err.message);
  }
};

// منع إغلاق الصندوق عند النقر بداخله
panel.addEventListener('click', e => {
  e.stopPropagation();
});
