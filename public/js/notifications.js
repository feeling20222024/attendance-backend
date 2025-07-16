// notifications.js
// هذا الملف لا يستورد Firebase إطلاقاً، يختص فقط بتحميل/عرض/مسح سجل الإشعارات

const STORAGE_KEY = 'notificationsLog';
const SUPERVISOR_CODE = '35190'; // كود المشرف

export function loadNotifications() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

export function saveNotifications(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

export function updateBellCount() {
  const count = loadNotifications().length;
  const badge = document.getElementById('notifCount');
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-block' : 'none';
}

export function renderNotifications() {
  const list = document.getElementById('notificationsLog');
  const clearBtn = document.getElementById('clearNotifications');
  const notifs = loadNotifications();
  list.innerHTML = '';
  if (notifs.length === 0) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    clearBtn.classList.add('hidden');
  } else {
    notifs.forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-1';
      li.innerHTML = `
        <div class="font-semibold">${n.title}</div>
        <div class="text-sm">${n.body}</div>
        <div class="text-xs text-gray-400">${n.time}</div>
      `;
      list.appendChild(li);
    });
    // إظهار زر المسح للمشرف فقط
    clearBtn.classList.toggle('hidden', window.currentUser !== SUPERVISOR_CODE);
  }
}

// الدالة العمومية لإضافة إشعار جديد
window.addNotification = function({ title, body, time }) {
  const arr = loadNotifications();
  arr.unshift({ title, body, time });
  if (arr.length > 50) arr.pop();
  saveNotifications(arr);
  renderNotifications();
  updateBellCount();
};

// مسح السجل
document.getElementById('clearNotifications')
  .addEventListener('click', () => {
    if (confirm('مسح جميع الإشعارات؟')) {
      localStorage.removeItem(STORAGE_KEY);
      renderNotifications();
      updateBellCount();
    }
  });

// ربط الحدث على أيقونة الجرس
document.getElementById('notifBell')
  .addEventListener('click', () => {
    const panel = document.getElementById('notificationsPanel');
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    renderNotifications();
    updateBellCount();
  });

// عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  renderNotifications();
  updateBellCount();
});
