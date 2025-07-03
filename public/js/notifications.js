// public/js/notifications.js

// —————————————————————————————————————————
// مفتاح التخزين المشترك
// —————————————————————————————————————————
const STORAGE_KEY = 'notifications';

// —————————————————————————————————————————
// 1) تحميل الإشعارات من localStorage
// —————————————————————————————————————————
function loadNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// —————————————————————————————————————————
// 2) حفظ قائمة الإشعارات في localStorage
// —————————————————————————————————————————
function saveNotifications(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

// —————————————————————————————————————————
// 3) رسم اللوحة وتحديث العداد
// —————————————————————————————————————————
function renderNotifications() {
  const notifs = loadNotifications();
  const ul     = document.getElementById('notificationsLog');
  const count  = document.getElementById('notifCount');
  const clearB = document.getElementById('clearNotifications');

  // حدّث العداد
  count.textContent = notifs.length;
  count.style.display = notifs.length > 0 ? 'inline-block' : 'none';

  // املأ القائمة
  if (notifs.length === 0) {
    ul.innerHTML = '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';
  } else {
    ul.innerHTML = notifs.map(n => `
      <li class="mb-2 border-b pb-2">
        <div class="font-semibold text-gray-800">${n.title}</div>
        <div class="text-sm text-gray-700">${n.body}</div>
        <div class="text-xs text-gray-400 mt-1">${n.time}</div>
      </li>
    `).join('');
  }

  // إظهار زر المسح للمشرف فقط
  if (window.currentUser === '35190' && notifs.length > 0) {
    clearB.classList.remove('hidden');
  } else {
    clearB.classList.add('hidden');
  }
}

// —————————————————————————————————————————
// 4) مسح الإشعارات
// —————————————————————————————————————————
function clearNotifications() {
  if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  alert('✅ تم مسح الإشعارات بنجاح');
}

// —————————————————————————————————————————
// 5) تهيئة واجهة الإشعارات
// —————————————————————————————————————————
window.initNotifications = function() {
  const bell   = document.getElementById('notifBell');
  const panel  = document.getElementById('notificationsPanel');
  const clearB = document.getElementById('clearNotifications');

  // عند الضغط على الجرس: إعادة الرسم وفتح/إغلاق اللوحة
  bell.addEventListener('click', () => {
    renderNotifications();
    panel.classList.toggle('hidden');
  });

  // ربط زر المسح
  clearB.addEventListener('click', clearNotifications);

  // عرض السجل فور التهيئة
  renderNotifications();
};

// استدعاء initNotifications عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  window.initNotifications();
});

// —————————————————————————————————————————
// 6) دالة تُستدعى من push.js أو initPushNative
// لإضافة إشعار جديد إلى السجل
// —————————————————————————————————————————
window.addNotificationToLog = function({ title, body, time }) {
  const notifs = loadNotifications();
  notifs.unshift({ title, body, time });
  if (notifs.length > 50) notifs.pop();
  saveNotifications(notifs);
  renderNotifications();
};
