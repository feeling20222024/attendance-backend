// public/js/notifications.js

(function() {
  const STORAGE_KEY  = 'notificationsLog';
  const API_BASE     = 'https://dwam-app-by-omar.onrender.com/api';
  const bell         = document.getElementById('notifBell');
  const panel        = document.getElementById('notificationsPanel');
  const list         = document.getElementById('notificationsLog');
  const clearBtn     = document.getElementById('clearNotifications');
  const countBadge   = document.getElementById('notifCount');
  const SUPERVISOR   = '35190';

  // 1) تحميل الإشعارات من localStorage
  function loadNotifications() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  // 2) حفظ الإشعارات إلى localStorage
  function saveNotifications(notifs) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
  }

  // 3) عرض الإشعارات في اللوحة وتحديث العداد
  function renderNotifications() {
    const notifs = loadNotifications();
    if (notifs.length === 0) {
      list.innerHTML = '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';
    } else {
      list.innerHTML = notifs.map(n => `
        <li class="mb-4 border-b pb-2">
          <div class="font-semibold text-gray-800">${n.title}</div>
          <div class="text-sm text-gray-700">${n.body}</div>
          <div class="text-xs text-gray-400 mt-1">${n.time}</div>
        </li>
      `).join('');
    }
    countBadge.textContent   = notifs.length;
    countBadge.style.display = notifs.length ? 'inline-block' : 'none';
    clearBtn.style.display   = (notifs.length && window.currentUser === SUPERVISOR)
                              ? 'inline-block'
                              : 'none';
  }

  // 4) جلب سجل الإشعارات من الخادم
  async function fetchServerNotifications() {
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      });
      if (!res.ok) throw new Error('Fetch failed');
      const { notifications } = await res.json();
      saveNotifications(notifications);
      renderNotifications();
    } catch {
      // تجاهل الأخطاء في الجلب الأولي
    }
  }

  // 5) مسح سجل الإشعارات على الخادم والمحلي
  async function clearAllNotifications() {
    if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
    try {
      await fetch(`${API_BASE}/notifications`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
        }
      });
    } catch {
      // حتى لو فشل الحذف على الخادم، نمسح محليًا
    }
    saveNotifications([]);
    renderNotifications();
  }

  // 6) حدث الضغط على جرس الإشعارات
  bell.addEventListener('click', () => {
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) renderNotifications();
  });

  // 7) حدث مسح الإشعارات
  clearBtn.addEventListener('click', clearAllNotifications);

  // 8) دوال يمكن استدعاؤها من push.js
  window.renderNotifications = renderNotifications;
  window.updateBellCount    = () => {
    const cnt = loadNotifications().length;
    countBadge.textContent   = cnt;
    countBadge.style.display = cnt ? 'inline-block' : 'none';
  };

  // 9) التهيئة الأولية
  document.addEventListener('DOMContentLoaded', () => {
    renderNotifications();
    fetchServerNotifications();
  });
})();
