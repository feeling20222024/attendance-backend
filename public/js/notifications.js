// public/js/notifications.js

const STORAGE_KEY = 'notificationsLog';
const SUPERVISOR_CODE = '35190';  // أو الكود اللي تختاره للمشرف

export function loadNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveNotifications(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

export function updateBellCount() {
  const count = loadNotifications().length;
  const badge = document.getElementById('notifCount');
  if (!badge) return;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-block' : 'none';
}

export function renderNotifications() {
  const list = document.getElementById('notificationsLog');
  const clearBtn = document.getElementById('clearNotifications');
  const notifs = loadNotifications();
  if (!list || !clearBtn) return;

  list.innerHTML = notifs.length
    ? notifs.map(n => `
        <li class="mb-2 border-b pb-2">
          <div class="font-semibold">${n.title}</div>
          <div class="text-sm">${n.body}</div>
          <div class="text-xs text-gray-500">${n.time}</div>
        </li>
      `).join('')
    : '<li class="text-gray-500">لا توجد إشعارات</li>';

  // إظهار زر المسح للمشرف فقط
  if (window.currentUser === SUPERVISOR_CODE && notifs.length) {
    clearBtn.style.display = 'block';
  } else {
    clearBtn.style.display = 'none';
  }
}

export function clearNotifications() {
  if (window.currentUser !== SUPERVISOR_CODE) {
    return alert('لا تملك صلاحية المسح.');
  }
  if (!confirm('مسح جميع الإشعارات؟')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  updateBellCount();
}

// تُستخدم من خارج هذا الملف لإضافة إشعار جديد:
window.addNotification = function({ title, body, time }) {
  const arr = loadNotifications();
  arr.unshift({ title, body, time });
  if (arr.length > 50) arr.pop();
  saveNotifications(arr);
  updateBellCount();
  // إذا اللوحة مفتوحة
  const panel = document.getElementById('notificationsPanel');
  if (panel && panel.style.display !== 'none') {
    renderNotifications();
  }
};

// ربط الأحداث عند التحميل
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('notifBell')?.addEventListener('click', () => {
    const panel = document.getElementById('notificationsPanel');
    if (!panel) return;
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    renderNotifications();
    updateBellCount();
  });
  document.getElementById('clearNotifications')?.addEventListener('click', clearNotifications);
  // تحديث واجهة الإشعارات عند بدء التشغيل
  updateBellCount();
  renderNotifications();
});
