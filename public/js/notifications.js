// —————————————————————————————————————————————————————————————
// Constants
const STORAGE_KEY     = 'notificationsLog';
const SUPERVISOR_CODE = '35190';

// —————————————————————————————————————————————————————————————
// قراءة الإشعارات من localStorage
function loadNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// —————————————————————————————————————————————————————————————
// تحديث عداد الجرس
function updateBellCount() {
  const count = loadNotifications().length;
  const bellCount = document.getElementById('notifCount');
  if (!bellCount) return;
  bellCount.textContent = count;
  bellCount.style.display = count > 0 ? 'inline-block' : 'none';
}

// —————————————————————————————————————————————————————————————
// رسم محتوى لوحة الإشعارات
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
    console.log('🧪 Showing clear button for currentUser:', window.currentUser);
    clearB.classList.remove('hidden');
    clearB.style.display = 'inline-block';
  } else {
    console.log('🧪 Hiding clear button for currentUser:', window.currentUser);
    clearB.classList.add('hidden');
    clearB.style.display = 'none';
  }
}

// —————————————————————————————————————————————————————————————
// مسح سجل الإشعارات (للمشرف فقط)
function clearNotifications() {
  if (window.currentUser !== SUPERVISOR_CODE) {
    alert('ليس لديك صلاحية لمسح سجل الإشعارات.');
    return;
  }
  if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;

  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  updateBellCount();
}

// —————————————————————————————————————————————————————————————
// ربط الأحداث عند تحميل الـDOM
document.addEventListener('DOMContentLoaded', function() {
  const bell   = document.getElementById('notifBell');
  const panel  = document.getElementById('notificationsPanel');
  const clearB = document.getElementById('clearNotifications');

  updateBellCount();

  if (!bell || !panel || !clearB) return;

  bell.addEventListener('click', function() {
    // ضمان ظهور اللوحة حتى لو كانت مخفية بـ style أو class
    const isHidden = panel.classList.contains('hidden') || getComputedStyle(panel).display === 'none';

    if (isHidden) {
      panel.classList.remove('hidden');
      panel.style.display = 'block';
    } else {
      panel.classList.add('hidden');
      panel.style.display = 'none';
    }

    renderNotifications();
    updateBellCount();
  });

  clearB.addEventListener('click', clearNotifications);
});
// —————————————————————————————————————————————————————————————
// دالة تُستدعى عند وصول إشعار جديد من push.js أو SW
window.addNotification = async ({ title, body, time }) => {
  // أولاً أرسل الإشعار للخادم
  try {
    await fetch(`${API_BASE}/notifications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
      },
      body: JSON.stringify({ title, body, time })
    });
  } catch (err) {
    console.error('❌ خطأ في إرسال الإشعار للخادم:', err);
  }

  // ثم حدّث الواجهة محلياً
  const saved = JSON.parse(localStorage.getItem('notificationsLog') || '[]');
  saved.unshift({ title, body, time });
  if (saved.length > 50) saved.pop();
const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  if (typeof window.renderNotifications === 'function') window.renderNotifications();
  if (typeof window.updateBellCount === 'function')     window.updateBellCount();

  console.log('📩 إشعار مضاف (محلياً وعلى الخادم):', { title, body, time });

  // حدّث العداد دائمًا
  updateBellCount();
};
