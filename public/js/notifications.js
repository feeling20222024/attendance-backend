const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';
window.serverNotifications = [];

// حفظ الإشعارات محليًا
function persistNotifications() {
  try {
    localStorage.setItem('serverNotifications', JSON.stringify(window.serverNotifications));
  } catch(e){}
}

// عرض الإشعارات في الواجهة
function renderNotifications() {
  const list  = document.getElementById('notificationsLog');
  const badge = document.getElementById('notifCount');
  if (!list || !badge) return;

  list.innerHTML = '';
  if (!window.serverNotifications.length) {
    // 🔹 قبل تسجيل الدخول نعرض رسالة للزائر
    if (!window.jwtToken) {
      list.innerHTML = '<li class="text-gray-500">🔑 سجّل الدخول لرؤية إشعاراتك</li>';
    } else {
      list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    }
    badge.classList.add('hidden');
  } else {
    window.serverNotifications.forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-1';
      li.innerHTML = `<strong>${n.title || ''}</strong><br><small>${n.body || ''}</small>`;
      list.appendChild(li);
    });
    badge.textContent = String(window.serverNotifications.length);
    badge.classList.remove('hidden');
  }
}

// جلب الإشعارات العامة (قبل تسجيل الدخول)
async function fetchPublicNotifications() {
  try {
    const res = await fetch(`${API_BASE}/public-notifications`);
    if (!res.ok) throw new Error('فشل جلب الإشعارات العامة');
    const data = await res.json();
    window.serverNotifications = data.notifications || [];
    persistNotifications();
    renderNotifications();
  } catch(e) {
    console.warn('fetchPublicNotifications failed', e);
    renderNotifications();
  }
}

// ضبط سلوك زر الجرس والعداد عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  // جلب إشعارات عامة فور تحميل الصفحة
  fetchPublicNotifications();

  const bell = document.getElementById('notifBell');
  const panel = document.getElementById('notificationsPanel');

  if (bell && panel) {
    bell.addEventListener('click', async e => {
      e.stopPropagation();
      panel.classList.toggle('hidden');
      if (!panel.classList.contains('hidden')) {
        // بعد فتح اللوحة نطلب الإشعارات الخاصة إذا موجود JWT
        if (window.jwtToken) await openNotificationLog();
      }
    });

    document.body.addEventListener('click', () => {
      if (!panel.classList.contains('hidden')) panel.classList.add('hidden');
    });
  }
});


  // زر المسح (إن وُجد)
  if (clear) {
    clear.addEventListener('click', async e => {
      e.stopPropagation();
      if (window.currentUser !== SUPERVISOR_CODE) {
        alert('غير مسموح لك بمسح الإشعارات.');
        return;
      }
      if (!confirm('هل أنت متأكد من مسح جميع الإشعارات؟')) return;

      try {
        await fetch(`${API_BASE}/notifications`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.jwtToken}`
          }
        });
      } catch (err) {
        console.warn('clear notifications failed', err);
        // نتابع لمسح السجل المحلي حتى إن فشل الطلب
      }

      window.serverNotifications = [];
      persistNotifications();
      renderNotifications();
    });
  }

  // عند تحميل الصفحة: قم بمحاولة جلب إشعارات الخادم فورًا (تعمل قبل تسجيل الدخول أيضاً)
  // هذا يضمن أن الزائر يرى إشعارات عامة في البداية.
  openNotificationLog().catch(err => {
    console.warn('initial openNotificationLog failed', err);
  });
}); // نهاية DOMContentLoaded

