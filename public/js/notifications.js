(function(){
  const bell       = document.getElementById('notifBell');
  const panel      = document.getElementById('notificationsPanel');
  const list       = document.getElementById('notificationsLog');
  const clearBtn   = document.getElementById('clearNotifications');
  const countBadge = document.getElementById('notifCount');
  const SUPERVISOR = '35190';

  function renderNotifications() {
    const notifs = window.serverNotifications || [];
    list.innerHTML = notifs.length
      ? notifs.map(n => `<li class="mb-2 border-b pb-1">…</li>`).join('')
      : '<li class="text-gray-500">لا توجد إشعارات</li>';

    countBadge.textContent = notifs.length;
    countBadge.style.display = notifs.length ? 'inline-block' : 'none';

    clearBtn.style.display = 
      (window.currentUser === SUPERVISOR && notifs.length)
        ? 'inline-block'
        : 'none';
  }

  bell.addEventListener('click', async () => {
    panel.style.display = panel.style.display==='block' ? 'none' : 'block';
    if (panel.style.display==='block') {
      await window.initNotifications();
      renderNotifications();
    }
  });
  

  clearBtn.addEventListener('click', async () => {
    if (window.currentUser !== SUPERVISOR) return;
    await fetch(`${API_BASE}/notifications`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('jwtToken')}` }
    });
    window.serverNotifications = [];
    renderNotifications();
  });
window.initNotifications = async () => {
  try {
    const res = await fetch(`${API_BASE}/notifications`, {
      headers: { 'Authorization': `Bearer ${localStorage.getItem('jwtToken')}` }
    });
    const data = await res.json();
    window.serverNotifications = data.notifications || [];
  } catch (e) {
    console.error('فشل تحميل الإشعارات:', e);
    window.serverNotifications = [];
  }
};
  window.addNotification = ({ title, body, time }) => {
    window.serverNotifications = window.serverNotifications || [];
    window.serverNotifications.unshift({ title, body, time });
    if (window.serverNotifications.length>50) window.serverNotifications.pop();
    renderNotifications();
  };

  document.addEventListener('DOMContentLoaded', renderNotifications);
})();
