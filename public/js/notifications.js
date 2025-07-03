// notifications.js

// —————————————————————————————————————————
// 1) جلب الإشعارات من localStorage
// —————————————————————————————————————————
function loadNotifications() {
  return JSON.parse(localStorage.getItem('notificationsLog') || '[]');
}

// —————————————————————————————————————————
// 2) عرض العدد على الأيقونة
// —————————————————————————————————————————
function updateBellCount() {
  const count = loadNotifications().length;
  const bellCount = document.getElementById('notifCount');
  bellCount.textContent = count;
  bellCount.style.display = count > 0 ? 'inline-block' : 'none';
}

// —————————————————————————————————————————
// 3) بناء قائمة الإشعارات في اللوحة
// —————————————————————————————————————————
function renderNotificationsPanel() {
  const notifs = loadNotifications();
  const list    = document.getElementById('notificationsLog');
  const clearB  = document.getElementById('clearNotifications');
  list.innerHTML = '';

  if (notifs.length === 0) {
    list.innerHTML = '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';
    clearB.classList.add('hidden');
  } else {
    notifs.forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2';
      li.innerHTML = `
        <div class="font-semibold">${n.title}</div>
        <div class="text-sm">${n.body}</div>
        <div class="text-xs text-gray-400">${n.time}</div>
      `;
      list.appendChild(li);
    });
    // زر المسح فقط للمشرف
    if (window.currentUser === '35190') {
      clearB.classList.remove('hidden');
    } else {
      clearB.classList.add('hidden');
    }
  }
}

// —————————————————————————————————————————
// 4) تفريغ الإشعارات
// —————————————————————————————————————————
function clearNotifications() {
  if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
  localStorage.removeItem('notificationsLog');
  renderNotificationsPanel();
  updateBellCount();
}

// —————————————————————————————————————————
// 5) تهيئة أحداث الجرس والزر
// —————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  const bell   = document.getElementById('notifBell');
  const panel  = document.getElementById('notificationsPanel');
  const clearB = document.getElementById('clearNotifications');

  bell.addEventListener('click', () => {
    renderNotificationsPanel();
    updateBellCount();
    panel.classList.toggle('hidden');
  });

  clearB.addEventListener('click', clearNotifications);

  // عرض العدد عند التحميل
  updateBellCount();
});

// —————————————————————————————————————————
// 6) تعريف initNotifications في النطاق العام
// —————————————————————————————————————————
window.initNotifications = function() {
  renderNotificationsPanel();
  updateBellCount();
};

// —————————————————————————————————————————
// 7) دالة تُستدعى من push.js عند وصول إشعار جديد
// —————————————————————————————————————————
window.addNotificationToLog = ({ title, body, time }) => {
  const existing = JSON.parse(localStorage.getItem('notificationsLog') || '[]');
  existing.unshift({ title, body, time });
  if (existing.length > 50) existing.pop();
  localStorage.setItem('notificationsLog', JSON.stringify(existing));
};
window.addNotificationToLog = window.addNotification;

