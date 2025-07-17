// public/js/notifications.js
(function(){
  const STORAGE_KEY = 'notificationsLog';
  const bell        = document.getElementById('notifBell');
  const panel       = document.getElementById('notificationsPanel');
  const list        = document.getElementById('notificationsLog');
  const clearBtn    = document.getElementById('clearNotifications');
  const countBadge  = document.getElementById('notifCount');
  const SUPERVISOR  = '35190';

  // تحميل الإشعارات من localStorage
  function loadNotifications() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  // عرض الإشعارات في اللوحة وتحديث العداد
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
    // تحديث العداد
    countBadge.textContent = notifs.length;
    countBadge.style.display = notifs.length ? 'inline-block' : 'none';
    // إظهار زر المسح فقط للمشرف
 clearBtn.style.display = notifs.length ? 'inline-block' : 'none';
  }

  // تبديل عرض اللوحة عند الضغط على الجرس
  bell.addEventListener('click', () => {
    // **إزالة شرط تسجيل الدخول** لنفتح اللوحة دائماً
    const isOpen = panel.style.display === 'block';
    panel.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) renderNotifications();
  });

  // مسح سجل الإشعارات (للمشرف فقط)
  clearBtn.addEventListener('click', () => {
    // if (window.currentUser !== SUPERVISOR) return;
    if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
    localStorage.removeItem(STORAGE_KEY);
    renderNotifications();
  });

  // دوال يمكن لـ push.js استدعاؤها
  window.renderNotifications = renderNotifications;
  window.updateBellCount = () => {
    const cnt = loadNotifications().length;
    countBadge.textContent = cnt;
    countBadge.style.display = cnt ? 'inline-block' : 'none';
  };

  // تهيئة أولية للعداد
  updateBellCount();
})();
