// public/js/notifications.js
// —————————————————————————————————————————
// هذا الملف يعمل كـ module
// —————————————————————————————————————————

// 1) الثوابت
const STORAGE_KEY    = 'notificationsLog';
const SUPERVISOR_UID = '35190';

// 2) تحميل الإشعارات من localStorage
export function loadNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// 3) حفظ الإشعارات في localStorage
function saveNotifications(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// 4) تحديث عداد الجرس
export function updateBellCount() {
  const count     = loadNotifications().length;
  const bellCount = document.getElementById('notifCount');
  if (!bellCount) return;
  bellCount.textContent = count;
  bellCount.style.display = count > 0 ? 'inline-block' : 'none';
}

// 5) رسم لوحة الإشعارات
export function renderNotifications() {
  const list   = document.getElementById('notificationsLog');
  const clearB = document.getElementById('clearNotifications');
  const notifs = loadNotifications();
  if (!list || !clearB) return;

  list.innerHTML = '';
  if (notifs.length === 0) {
    list.innerHTML = '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';
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
  }
  // إظهار زر المسح للمشرف فقط
  if (window.currentUser === SUPERVISOR_UID && notifs.length > 0) {
    clearB.classList.remove('hidden');
  } else {
    clearB.classList.add('hidden');
  }
}

// 6) دالة لمسح السجل
export function clearNotifications() {
  if (window.currentUser !== SUPERVISOR_UID) {
    return alert('ليس لديك صلاحية لمسح سجل الإشعارات.');
  }
  if (!confirm('هل أنت متأكد؟')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  updateBellCount();
}

// 7) إضافة إشعار جديد
window.addNotification = function({ title, body, time }) {
  const arr = loadNotifications();
  arr.unshift({ title, body, time });
  if (arr.length > 50) arr.pop();
  saveNotifications(arr);
  updateBellCount();
  const panel = document.getElementById('notificationsPanel');
  if (panel && !panel.classList.contains('hidden')) {
    renderNotifications();
  }
};

// 8) ربط الأحداث عند تحميل DOM
document.addEventListener('DOMContentLoaded', () => {
  const bell   = document.getElementById('notifBell');
  const panel  = document.getElementById('notificationsPanel');
  const clearB = document.getElementById('clearNotifications');

  updateBellCount();
  renderNotifications();

  bell?.addEventListener('click', () => {
    panel.classList.toggle('hidden');
    renderNotifications();
    updateBellCount();
  });
  clearB?.addEventListener('click', clearNotifications);
});
