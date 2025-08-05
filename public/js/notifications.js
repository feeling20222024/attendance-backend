(function(){
  const bell       = document.getElementById('notifBell');
  const panel      = document.getElementById('notificationsPanel');
  const list       = document.getElementById('notificationsLog');
  const clearBtn   = document.getElementById('clearNotifications');
  const countBadge = document.getElementById('notifCount');
  const SUPERVISOR = '35190';

  // ——————————————————————————————
  // ▸ 1) تعريف initNotifications أولًا
  window.initNotifications = async () => {
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      window.serverNotifications = data.notifications || [];
    } catch (e) {
      console.error('❌ فشل تحميل الإشعارات:', e);
      window.serverNotifications = [];
    }
  };

  // ▸ 2) رسم الإشعارات
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
    clearBtn.style.display = (window.currentUser === SUPERVISOR && notifs.length)
      ? 'inline-block' : 'none';
  }

  // ——————————————————————————————
  // ▸ 3) ربط الجرس
  bell.addEventListener('click', async () => {
    panel.style.display = panel.style.display==='block' ? 'none' : 'block';
    if (panel.style.display==='block') {
      await window.initNotifications();  // الآن الدالة موجودة
      renderNotifications();
    }
  });

  // ▸ 4) زر المسح (للمشرف فقط)
  clearBtn.addEventListener('click', async () => {
    if (window.currentUser !== SUPERVISOR) return;
    await fetch(`${API_BASE}/notifications`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`,
        'Content-Type': 'application/json'
      }
    });
    window.serverNotifications = [];
    renderNotifications();
  });

  // ▸ 5) استقبال إشعار جديد
  window.addNotification = ({ title, body, time }) => {
    window.serverNotifications = window.serverNotifications || [];
    window.serverNotifications.unshift({ title, body, time });
    if (window.serverNotifications.length>50) window.serverNotifications.pop();
    renderNotifications();
  };

  // ▸ 6) تهيئة العرض عند التحميل
  document.addEventListener('DOMContentLoaded', renderNotifications);
})();
