// notifications.js — عرض الإشعارات وتحديث الواجهة

const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';

window.serverNotifications = [];

// كل التعامل مع الواجهة بعد التحميل
document.addEventListener('DOMContentLoaded', () => {
  const panel       = document.getElementById('notificationsPanel');
  const list        = document.getElementById('notificationsLog');
  const badge       = document.getElementById('notifCount');
  const bell        = document.getElementById('notifBell');
  const clearButton = document.getElementById('clearNotifications');

  // 1) رسم الإشعارات
  function renderNotifications() {
    if (!list || !badge || !clearButton) return;
    list.innerHTML = '';
    const arr = window.serverNotifications || [];
    if (arr.length === 0) {
      list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
      badge.classList.add('hidden');
    } else {
      arr.slice(0, 50).forEach(n => {
        const li = document.createElement('li');
        li.className = 'mb-2 border-b pb-1';
        const timeStr = new Date(n.timestamp).toLocaleString('ar-EG', {
          dateStyle: 'short',
          timeStyle: 'short'
        });
        li.innerHTML = `
          <strong>${n.title || '(بدون عنوان)'}</strong><br>
          <small>${n.body || ''}</small><br>
          <small class="text-gray-400">${timeStr}</small>
        `;
        list.appendChild(li);
      });
      badge.textContent = arr.length;
      badge.classList.remove('hidden');
    }

    // زر المسح للمشرف فقط
    if (window.currentUser === SUPERVISOR_CODE && arr.length > 0) {
      clearButton.classList.remove('hidden');
    } else {
      clearButton.classList.add('hidden');
    }
  }

  // 2) إضافة إشعار جديد
  window.addNotification = ({ title, body, timestamp }) => {
    const now = timestamp || Date.now();
    const arr = window.serverNotifications || [];
    if (arr[0]?.title === title && arr[0]?.body === body) return;
    arr.unshift({ title, body, timestamp: now });
    window.serverNotifications = arr.slice(0, 50);

    // عدّاد
    badge.textContent = window.serverNotifications.length;
    badge.classList.remove('hidden');
    // تحديث السجل إذا مفتوح
    if (!panel.classList.contains('hidden')) renderNotifications();
  };

  // 3) جلب من الخادم ثم عرض
  async function openNotificationLog() {
    if (!window.jwtToken) {
      renderNotifications();
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { Authorization: `Bearer ${window.jwtToken}` }
      });
      if (!res.ok) throw new Error();
      const { notifications } = await res.json();
      window.serverNotifications = notifications || [];
    } catch {
      window.serverNotifications = [];
    }
    renderNotifications();
  }
  window.openNotificationLog = openNotificationLog;

  // 4) تفعيل الأزرار
  if (panel && bell) {
    panel.addEventListener('click', e => e.stopPropagation());
    bell.addEventListener('click', async e => {
      e.stopPropagation();
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        await openNotificationLog();
      }
    });
    document.addEventListener('click', () => panel.classList.add('hidden'));
  }

  // 5) مسح الإشعارات
  if (clearButton) {
    clearButton.addEventListener('click', async e => {
      e.stopPropagation();
      if (window.currentUser !== SUPERVISOR_CODE) return;
      if (!confirm('هل أنت متأكد من مسح جميع الإشعارات؟')) return;
      try {
        await fetch(`${API_BASE}/notifications`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${window.jwtToken}` }
        });
        window.serverNotifications = [];
        renderNotifications();
      } catch {
        alert('فشل مسح الإشعارات.');
      }
    });
  }

  // 6) تحديث العداد مبدئياً
  if (window.serverNotifications.length > 0) {
    badge.textContent = window.serverNotifications.length;
    badge.classList.remove('hidden');
  }
});
