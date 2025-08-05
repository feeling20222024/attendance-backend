(function(){
  // اجلب API_BASE من window أو اعطِ قيمة افتراضية
  const API_BASE = window.API_BASE || 'https://dwam-app-by-omar.onrender.com/api';
  const bell       = document.getElementById('notifBell');
  const panel      = document.getElementById('notificationsPanel');
  const list       = document.getElementById('notificationsLog');
  const clearBtn   = document.getElementById('clearNotifications');
  const countBadge = document.getElementById('notifCount');
  const SUPERVISOR = '35190';

 // 1) تهيئة جلب التنبيهات من الخادم
  window.initNotifications = async () => {
    const token = localStorage.getItem('jwtToken');
    if (!token) {
      // لا توكن → افتراضيًا سجلّ فارغ
      window.serverNotifications = [];
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      window.serverNotifications = data.notifications || [];
    } catch (e) {
      console.error('❌ فشل تحميل الإشعارات:', e);
      window.serverNotifications = [];
    }
  };

  // 2) رسم التنبيهات
  function renderNotifications() {
    const notifs = window.serverNotifications || [];
    list.innerHTML = notifs.length
      ? notifs.map(n => `
          <li class="mb-2 border-b pb-1">
            <strong>${n.title}</strong><br>
            <small>${n.body}</small><br>
            <small class="text-gray-400">${n.time}</small>
          </li>
        `).join('')
      : '<li class="text-gray-500">لا توجد إشعارات</li>';
    countBadge.textContent = notifs.length;
    countBadge.style.display = notifs.length ? 'inline-block' : 'none';
    clearBtn.style.display =
      (window.currentUser === SUPERVISOR && notifs.length)
        ? 'inline-block'
        : 'none';
  }

  // 3) ربط الجرس
  bell.addEventListener('click', async () => {
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    if (panel.style.display === 'block') {
      await window.initNotifications();
      renderNotifications();
    }
  });

  // 4) زر المسح
  clearBtn.addEventListener('click', async () => {
    if (window.currentUser !== SUPERVISOR) return;
    if (!confirm('مسح جميع الإشعارات؟')) return;
    await fetch(`${API_BASE}/notifications`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
      }
    });
    window.serverNotifications = [];
    renderNotifications();
  });

  // 5) استقبال إشعار جديد
  window.addNotification = ({ title, body, time }) => {
    window.serverNotifications = window.serverNotifications || [];
    window.serverNotifications.unshift({ title, body, time });
    if (window.serverNotifications.length > 50) window.serverNotifications.pop();
    renderNotifications();
  };

  // 6) العرض الابتدائي
  document.addEventListener('DOMContentLoaded', renderNotifications);
})();
