// public/js/notifications.js

// مفتاح التخزين المشترك
const STORAGE_KEY = 'notificationsLog';

// دالة تحميل الإشعارات
function loadNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// دالة رسم اللوحة وتحديث العداد
function renderNotifications() {
  const notifs = loadNotifications();
  const ul     = document.getElementById('notificationsLog');
  const count  = document.getElementById('notifCount');
  const clearB = document.getElementById('clearNotifications');

  // تحديث العداد
  count.textContent = notifs.length;
  count.style.display = notifs.length > 0 ? 'inline-block' : 'none';

  // تفريغ القائمة ثم تعبئتها
  ul.innerHTML = notifs.length === 0
    ? '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>'
    : notifs.map(n => `
        <li class="mb-2 border-b pb-2">
          <div class="font-semibold text-gray-800">${n.title}</div>
          <div class="text-sm text-gray-700">${n.body}</div>
          <div class="text-xs text-gray-400 mt-1">${n.time}</div>
        </li>
      `).join('');

  // إظهار زر المسح للمشرف فقط
  if (window.currentUser === '35190' && notifs.length > 0) {
    clearB.classList.remove('hidden');
  } else {
    clearB.classList.add('hidden');
  }
}

// مسح الإشعارات
function clearNotifications() {
  if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  alert('✅ تم مسح الإشعارات بنجاح');
}

// تهيئة واجهة الإشعارات
window.initNotifications = function() {
  const bell  = document.getElementById('notifBell');
  const panel = document.getElementById('notificationsPanel');
  const clearB = document.getElementById('clearNotifications');

  // عند الضغط على الجرس: فتح/غلق اللوحة
  bell.addEventListener('click', () => {
    renderNotifications();      // نعيد الرسم دائماً
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

// دالة تضاف إليها من push.js عند وصول إشعار جديد
window.addNotificationToLog = function({ title, body, time }) {
  const notifs = loadNotifications();
  notifs.unshift({ title, body, time });
  if (notifs.length > 50) notifs.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs));
  // فور الإضافة حدّث الواجهة
  renderNotifications();
};
