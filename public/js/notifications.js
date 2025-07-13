// public/js/notifications.js
import { API_BASE } from './config.js';  // لو احتجت الـ API_BASE هنا

const STORAGE_KEY = 'notificationsLog';
export function loadNotifications() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
export function saveNotifications(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}
export function updateBellCount() {
  const count = loadNotifications().length;
  const bell = document.getElementById('notifCount');
  if (!bell) return;
  bell.textContent = count;
  bell.style.display = count ? 'inline-block' : 'none';
}
export function renderNotifications() {
  const list = document.getElementById('notificationsLog');
  const clearBtn = document.getElementById('clearNotifications');
  const notifs = loadNotifications();
  if (!list || !clearBtn) return;
  list.innerHTML = '';
  if (notifs.length === 0) {
    list.innerHTML = `<li class="text-gray-500 text-sm">لا توجد إشعارات</li>`;
    clearBtn.classList.add('hidden');
  } else {
    notifs.forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-2';
      li.innerHTML = `
        <div class="font-semibold">${n.title}</div>
        <div class="text-sm">${n.body}</div>
        <div class="text-xs text-gray-400">${new Date(n.time).toLocaleString()}</div>
      `;
      list.appendChild(li);
    });
    clearBtn.classList.remove('hidden');
  }
}

// هذه الدالة تُستدعى من push.js أو من أي مكان يأتي فيه إشعار
export window.addNotification = function({ title, body, time }) {
  const arr = loadNotifications();
  arr.unshift({ title, body, time });
  if (arr.length > 50) arr.pop();
  saveNotifications(arr);
  renderNotifications();
  updateBellCount();
};
