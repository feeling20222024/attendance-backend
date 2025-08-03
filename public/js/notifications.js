(function(){
  const STORAGE_KEY = 'notificationsLog';
  const bell        = document.getElementById('notifBell');
  const panel       = document.getElementById('notificationsPanel');
  const list        = document.getElementById('notificationsLog');
  const clearBtn    = document.getElementById('clearNotifications');
  const countBadge  = document.getElementById('notifCount');
  const SUPERVISOR  = '35190';

  function loadNotifications() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
    catch { return []; }
  }

  function renderNotifications() {
    const notifs = loadNotifications();
    if (!notifs.length) {
      list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    } else {
      list.innerHTML = notifs.map(n => `
        <li class="mb-2 border-b pb-1">
          <strong>${n.title}</strong><br>
          <small>${n.body}</small><br>
          <small class="text-gray-400">${n.time}</small>
        </li>
      `).join('');
    }
    countBadge.textContent = notifs.length;
    countBadge.style.display = notifs.length ? 'inline-block' : 'none';
    clearBtn.style.display = window.currentUser===SUPERVISOR && notifs.length ? 'inline-block' : 'none';
  }

  bell.addEventListener('click', () => {
    panel.style.display = panel.style.display==='block' ? 'none' : 'block';
    if (panel.style.display==='block') renderNotifications();
  });

  clearBtn.addEventListener('click', () => {
    if (confirm('مسح جميع الإشعارات؟')) {
      localStorage.removeItem(STORAGE_KEY);
      fetch('/api/notifications', { method:'DELETE', headers:{ 'Authorization': `Bearer ${localStorage.getItem('jwtToken')}` }})
        .then(()=>renderNotifications())
        .catch(console.error);
    }
  });

  window.addNotification = ({ title, body, time }) => {
    const arr = loadNotifications();
    arr.unshift({ title, body, time });
    if (arr.length>50) arr.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    renderNotifications();
  };
  window.renderNotifications = renderNotifications;
  window.updateBellCount = renderNotifications;

  renderNotifications();
})();
