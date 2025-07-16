// public/js/notifications.js

// —————————————————————————————————————————————
// المفاتيح والضوابط
// —————————————————————————————————————————————
const STORAGE_KEY      = 'notificationsLog';
const SUPERVISOR_CODE  = '35190';  // رمز المشرف لمسح السجل

// —————————————————————————————————————————————
// 1) تحميل الإشعارات من localStorage
// —————————————————————————————————————————————
export function loadNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// —————————————————————————————————————————————
// 2) حفظ مصفوفة الإشعارات في localStorage
// —————————————————————————————————————————————
export function saveNotifications(arr) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

// —————————————————————————————————————————————
// 3) تحديث عداد الجرس
// —————————————————————————————————————————————
export function updateBellCount() {
  const count = loadNotifications().length;
  const badge = document.getElementById('notifCount');
  if (!badge) return;
  badge.textContent = count;
  badge.style.display = count > 0 ? 'inline-block' : 'none';
}

// —————————————————————————————————————————————
// 4) رسم قائمة الإشعارات في اللوحة
// —————————————————————————————————————————————
export function renderNotifications() {
  const list      = document.getElementById('notificationsLog');
  const clearBtn  = document.getElementById('clearNotifications');
  const notifs    = loadNotifications();
  if (!list || !clearBtn) return;

  if (notifs.length === 0) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
  } else {
    list.innerHTML = notifs.map(n => `
      <li class="mb-2 border-b pb-2">
        <div class="font-semibold text-gray-800">${n.title}</div>
        <div class="text-sm text-gray-700">${n.body}</div>
        <div class="text-xs text-gray-500 mt-1">${n.time}</div>
      </li>
    `).join('');
  }

  // إظهار زر المسح للمشرف فقط إذا هناك إشعارات
  if (window.currentUser === SUPERVISOR_CODE && notifs.length > 0) {
    clearBtn.style.display = 'block';
  } else {
    clearBtn.style.display = 'none';
  }
}

// —————————————————————————————————————————————
// 5) مسح سجل الإشعارات (للمشرف فقط)
// —————————————————————————————————————————————
export function clearNotifications() {
  if (window.currentUser !== SUPERVISOR_CODE) {
    alert('لا تملك صلاحية مسح سجل الإشعارات.');
    return;
  }
  if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  updateBellCount();
}

// —————————————————————————————————————————————
// 6) إضافة إشعار جديد (يُستدعى من push.js أو من SW)
// —————————————————————————————————————————————
window.addNotification = function({ title, body, time }) {
  const arr = loadNotifications();
  arr.unshift({ title, body, time });
  if (arr.length > 50) arr.pop();
  saveNotifications(arr);
  updateBellCount();

  // إذا اللوحة مفتوحة، أعد رسمها
  const panel = document.getElementById('notificationsPanel');
  if (panel && getComputedStyle(panel).display !== 'none') {
    renderNotifications();
  }
  console.log('📩 إشعار مضاف:', { title, body, time });
};

// —————————————————————————————————————————————
// 7) ربط الأحداث عند تحميل الصفحة
// —————————————————————————————————————————————
document.addEventListener('DOMContentLoaded', () => {
  // النقر على أيقونة الجرس لفتح/إغلاق اللوحة
  document.getElementById('notifBell')?.addEventListener('click', () => {
    const panel = document.getElementById('notificationsPanel');
    if (!panel) return;
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    renderNotifications();
    updateBellCount();
  });

  // زر مسح الإشعارات
  document.getElementById('clearNotifications')?.addEventListener('click', clearNotifications);

  // إعداد الواجهة عند أول تحميل
  updateBellCount();
  renderNotifications();
});
