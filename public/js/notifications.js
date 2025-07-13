// public/js/notifications.js
// —————————————————————————————————————————————————————————————
// 0) استيراد الإعدادات المشتركة
// —————————————————————————————————————————————————————————————
import { API_BASE, messaging } from './config.js';
// —————————————————————————————————————————————————————————————
// A) مستمع رسائل من الـ Service Worker
// —————————————————————————————————————————————————————————————
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', event => {
    const msg = event.data;
    // نتأكد أن الرسالة من نوع إشعار جديد
    if (msg && msg.type === 'NEW_NOTIFICATION') {
      window.addNotification({
        title: msg.title,
        body:  msg.body,
        time:  msg.time
      });
    }
  });
}
// —————————————————————————————————————————————————————————————
// Constants
// —————————————————————————————————————————————————————————————
const STORAGE_KEY     = 'notificationsLog';
const SUPERVISOR_CODE = '35190';

// —————————————————————————————————————————————————————————————
// 1) جلب الإشعارات الموحدة من الخادم وتخزينها محليًا
// —————————————————————————————————————————————————————————————
window.initNotifications = async function() {
  if (!window.currentUser) return;

  try {
    const res = await fetch(`${API_BASE}/notifications/${window.currentUser}`);
    if (res.ok) {
      const serverNotifs = await res.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serverNotifs));
    }
  } catch (e) {
    console.warn('⚠️ لم نتمكن من جلب الإشعارات من الخادم:', e);
  }

  // ثم استمر في تهيئة الـ UI بعد التحميل:
  renderNotifications();
  updateBellCount();
};


// —————————————————————————————————————————————————————————————
// 1) قراءة الإشعارات من localStorage
function loadNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// —————————————————————————————————————————————————————————————
// 2) تحديث عداد الجرس
function updateBellCount() {
  const count = loadNotifications().length;
  const bellCount = document.getElementById('notifCount');
  if (!bellCount) return;
  bellCount.textContent = count;
  bellCount.style.display = count > 0 ? 'inline-block' : 'none';
}

// —————————————————————————————————————————————————————————————
// 3) رسم محتوى لوحة الإشعارات
function renderNotifications() {
  const list = document.getElementById('notificationsLog');
  const clearB = document.getElementById('clearNotifications');
  const notifs = loadNotifications();
  if (!list || !clearB) return;

  list.innerHTML = '';
  if (notifs.length === 0) {
    list.innerHTML = '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';
  } else {
    notifs.forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-4 border-b pb-2';
      li.innerHTML = `
        <div class="font-semibold text-gray-800">${n.title}</div>
        <div class="text-sm text-gray-700">${n.body}</div>
        <div class="text-xs text-gray-400 mt-1">${n.time}</div>
      `;
      list.appendChild(li);
    });
  }

  // إظهار زر المسح للمشرف فقط
  if (window.currentUser === SUPERVISOR_CODE && notifs.length > 0) {
    clearB.classList.remove('hidden');
    clearB.style.display = 'inline-block';
  } else {
    clearB.classList.add('hidden');
    clearB.style.display = 'none';
  }
}

// —————————————————————————————————————————————————————————————
// 4) مسح سجل الإشعارات (للمشرف فقط)
function clearNotifications() {
  if (window.currentUser !== SUPERVISOR_CODE) {
    alert('ليس لديك صلاحية لمسح سجل الإشعارات.');
    return;
  }
  if (!confirm('هل أنت متأكد؟')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  updateBellCount();
}

// —————————————————————————————————————————————————————————————
// 5) ربط الأحداث عند تحميل الـ DOM
document.addEventListener('DOMContentLoaded', () => {
  const bell   = document.getElementById('notifBell');
  const panel  = document.getElementById('notificationsPanel');
  const clearB = document.getElementById('clearNotifications');

  updateBellCount();
  renderNotifications();

  bell?.addEventListener('click', () => {
    const isHidden = panel.classList.contains('hidden') ||
                     getComputedStyle(panel).display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    panel.classList.toggle('hidden');
    renderNotifications();
    updateBellCount();
  });

  clearB?.addEventListener('click', clearNotifications);
});

// —————————————————————————————————————————————————————————————
// 6) إضافة إشعار جديد
window.addNotification = function(payload) {
  let saved = loadNotifications();
  saved.unshift({
    title: payload.title,
    body:  payload.body,
    time:  payload.time
  });
  if (saved.length > 50) saved.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

  // إن كانت اللوحة مفتوحة، أعد رسمها
  const panel = document.getElementById('notificationsPanel');
  if (panel && getComputedStyle(panel).display !== 'none') {
    renderNotifications();
  }

  // حدّث العداد دائمًا
  updateBellCount();
};
