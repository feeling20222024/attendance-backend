// public/js/notifications.js

(() => {
  const STORAGE_KEY = 'notificationsLog';

  // تحميل الإشعارات من localStorage
  function loadNotifications() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  // حفظ مصفوفة الإشعارات في localStorage
  function saveNotificationsLocal(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  // تحديث عداد الجرس
  window.updateBellCount = function() {
    const count = loadNotifications().length;
    const bellCount = document.getElementById('notifCount');
    if (!bellCount) return;
    bellCount.textContent = count;
    bellCount.style.display = count > 0 ? 'inline-block' : 'none';
  };

  // رسم لوحة الإشعارات
  window.renderNotifications = function() {
    const list   = document.getElementById('notificationsLog');
    const clearB = document.getElementById('clearNotifications');
    const notifs = loadNotifications();
    if (!list || !clearB) return;

    list.innerHTML = '';
    if (notifs.length === 0) {
      list.innerHTML = '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';
      clearB.classList.add('hidden');
    } else {
      notifs.forEach(n => {
        const li = document.createElement('li');
        li.className = 'mb-2 border-b pb-2';
        li.innerHTML = `
          <div class="font-semibold text-gray-800">${n.title}</div>
          <div class="text-sm text-gray-700">${n.body}</div>
          <div class="text-xs text-gray-400 mt-1">${n.time}</div>
        `;
        list.appendChild(li);
      });
      clearB.classList.remove('hidden');
    }
  };

  // مسح سجل الإشعارات
  function clearNotifications() {
    if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
    localStorage.removeItem(STORAGE_KEY);
    renderNotifications();
    updateBellCount();
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('notifBell')?.addEventListener('click', () => {
      const panel = document.getElementById('notificationsPanel');
      panel.classList.toggle('hidden');
      renderNotifications();
      updateBellCount();
    });
    document.getElementById('clearNotifications')?.addEventListener('click', clearNotifications);

    // أول رسم
    updateBellCount();
    renderNotifications();
  });

  // ⚙️ دالة تُستدعى من push.js و service worker
  window.addNotification = function({ title, body, time }) {
    // فقط إضافة محليًا؛ حفظ على الخادم يتم من push.js
    const saved = loadNotifications();
    saved.unshift({ title, body, time });
    if (saved.length > 50) saved.pop();
    saveNotificationsLocal(saved);

    // تحديث العرض
    updateBellCount();
    const panel = document.getElementById('notificationsPanel');
    if (panel && !panel.classList.contains('hidden')) {
      renderNotifications();
    }
  };
})();
