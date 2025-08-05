// js/notifications-ui.js

(function(){
  const bell       = document.getElementById('notifBell');
  const panel      = document.getElementById('notificationsPanel');
  const list       = document.getElementById('notificationsLog');
  const clearBtn   = document.getElementById('clearNotifications');
  const countBadge = document.getElementById('notifCount');
  const SUPERVISOR = '35190';

  // 1) رسم التنبيهات الموجودة في المتغيّر serverNotifications
  function renderNotifications() {
    // serverNotifications هو مصفوفة يتم تعبئتها بواسطة initNotifications()
    const notifs = window.serverNotifications || [];

    if (!notifs.length) {
      list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    } else {
      list.innerHTML = notifs.map(n => `
        <li class="mb-2 border-b pb-1">
          <strong>${n.title}</strong><br>
          <small>${n.body}</small><br>
          <small class="text-gray-400">${n.time}</small>
        </li>
      `).join('');
    }

    // عدّاد الجرس
    countBadge.textContent = notifs.length;
    countBadge.style.display = notifs.length ? 'inline-block' : 'none';

    // زر المسح للمشرف فقط
    if (window.currentUser === SUPERVISOR && notifs.length) {
      clearBtn.style.display = 'inline-block';
    } else {
      clearBtn.style.display = 'none';
    }
  }

  // 2) عند النقر على الجرس: إعادة جلب ثم عرض التنبيهات
  bell.addEventListener('click', async () => {
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    if (panel.style.display === 'block') {
      // initNotifications() جلب من الخادم
      if (typeof window.initNotifications === 'function') {
        await window.initNotifications();
      }
      renderNotifications();
    }
  });

  // 3) زر المسح (للمشرف فقط)
  clearBtn.addEventListener('click', async () => {
    if (window.currentUser !== SUPERVISOR) {
      return alert('غير مسموح لك بمسح الإشعارات.');
    }
    if (!confirm('مسح جميع الإشعارات؟')) return;

    try {
      // مسح من الخادم
      await fetch(`${API_BASE}/notifications`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${jwtToken}`
        }
      });
      // مسح محلياً
      window.serverNotifications = [];
      renderNotifications();
      alert('✅ تم مسح جميع الإشعارات.');
    } catch (e) {
      console.error(e);
      alert('❌ حدث خطأ أثناء مسح الإشعارات.');
    }
  });

  // 4) عند استقبال إشعار جديد (push foreground أو من addNotification)
  window.addNotification = ({ title, body, time }) => {
    window.serverNotifications = window.serverNotifications || [];
    window.serverNotifications.unshift({ title, body, time });
    if (window.serverNotifications.length > 50) {
      window.serverNotifications.pop();
    }
    renderNotifications();
  };

  // 5) ربط أولي: 
  // إذا كان هنالك مستخدم مسجّل سابقاً، نهيّئ count
  document.addEventListener('DOMContentLoaded', () => {
    renderNotifications();
  });
})();
