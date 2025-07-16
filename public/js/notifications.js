// public/js/notifications.js

(() => {
  const STORAGE_KEY = 'notificationsLog';
  const API_BASE    = 'https://dwam-app-by-omar.onrender.com/api';

  // —————————————————————————————————————————————————————————————
  // 1) Bootstrap: جلب الإشعارات من الخادم عند فتح الصفحة
  // —————————————————————————————————————————————————————————————
  async function bootstrapNotifications() {
    if (!window.currentUser) return;
    try {
      const res = await fetch(`${API_BASE}/notifications/${window.currentUser}`);
      if (res.ok) {
        const list = await res.json();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      }
    } catch (e) {
      console.warn('⚠️ خطأ جلب الإشعارات من الخادم:', e);
    }
  }

  // —————————————————————————————————————————————————————————————
  // 2) دوال localStorage
  // —————————————————————————————————————————————————————————————
  function loadNotifications() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveNotificationsLocal(arr) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  }

  // —————————————————————————————————————————————————————————————
  // 3) تحديث عداد الجرس
  // —————————————————————————————————————————————————————————————
  window.updateBellCount = function() {
    const count = loadNotifications().length;
    const bellCount = document.getElementById('notifCount');
    if (!bellCount) return;
    bellCount.textContent = count;
    bellCount.style.display = count > 0 ? 'inline-block' : 'none';
  };

  // —————————————————————————————————————————————————————————————
  // 4) رسم لوحة الإشعارات
  // —————————————————————————————————————————————————————————————
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

  // —————————————————————————————————————————————————————————————
  // 5) مسح سجل الإشعارات
  // —————————————————————————————————————————————————————————————
  function clearNotifications() {
    if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
    localStorage.removeItem(STORAGE_KEY);
    renderNotifications();
    updateBellCount();
  }

  // —————————————————————————————————————————————————————————————
  // 6) ربط الأحداث عند تحميل DOM + bootstrap
  // —————————————————————————————————————————————————————————————
  document.addEventListener('DOMContentLoaded', async () => {
    // أولاً: جلب الإشعارات من الخادم
    await bootstrapNotifications();

    // ثمّ ربط الأحداث
    document.getElementById('notifBell')?.addEventListener('click', () => {
      const panel = document.getElementById('notificationsPanel');
      panel.classList.toggle('hidden');
      renderNotifications();
      updateBellCount();
    });
    document.getElementById('clearNotifications')?.addEventListener('click', clearNotifications);

    // وأخيراً الرسم الأوّلي
    updateBellCount();
    renderNotifications();
  });

  // —————————————————————————————————————————————————————————————
  // 7) دالة إضافة إشعار جديدة (تُستدعى من push.js أو من الـ SW)
  // —————————————————————————————————————————————————————————————
  window.addNotification = function({ title, body, time }) {
    // 1) خزّن محليًّا
    const saved = loadNotifications();
    saved.unshift({ title, body, time });
    if (saved.length > 50) saved.pop();
    saveNotificationsLocal(saved);

    // 2) حدّث العرض
    updateBellCount();
    const panel = document.getElementById('notificationsPanel');
    if (panel && !panel.classList.contains('hidden')) {
      renderNotifications();
    }
  };
})();
