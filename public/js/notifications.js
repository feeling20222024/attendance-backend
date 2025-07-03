// notifications.js

// —————————————————————————————————————————
// 1) دالة لإظهار سجل الإشعارات قبل أو بعد التسجيل
// —————————————————————————————————————————
window.initNotifications = function() {
  const bell   = document.getElementById('notifBell');
  const panel  = document.getElementById('notificationsPanel');
  const list   = document.getElementById('notificationsLog');
  const count  = document.getElementById('notifCount');
  const clearB = document.getElementById('clearNotifications');

  function render() {
    const saved = JSON.parse(localStorage.getItem('notifications') || '[]');
    list.innerHTML = '';
    if (saved.length === 0) {
      list.innerHTML = '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';
      count.style.display = 'none';
      clearB.classList.add('hidden');
    } else {
      saved.forEach(n => {
        const li = document.createElement('li');
        li.className = 'mb-2';
        li.innerHTML = `
          <div class="font-semibold">${n.title}</div>
          <div class="text-sm">${n.body}</div>
          <div class="text-xs text-gray-400">${n.time}</div>
        `;
        list.appendChild(li);
      });
      count.textContent = saved.length;
      count.style.display = 'inline-block';
      // زر المسح فقط للمشرف
      if (window.currentUser === '35190') clearB.classList.remove('hidden');
      else clearB.classList.add('hidden');
    }
  }

  // تهيئة زر المسح
  clearB.addEventListener('click', () => {
    if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
    localStorage.removeItem('notifications');
    render();
  });

  // ارسم الواجهة فوراً
  render();

  // أظهر/أخفِ اللوحة عند الضغط على الجرس (حتى قبل login)
  bell.addEventListener('click', () => {
    panel.classList.toggle('hidden');
  });
};
// هذا يستدعي initNotifications بعد تحميل DOM
document.addEventListener('DOMContentLoaded', () => {
  if (typeof window.initNotifications === 'function') {
    window.initNotifications();
  }
});

// دالة لحفظ الإشعار في localStorage — تُستخدم في push.js
window.addNotification = function({ title, body, time }) {
  const saved = JSON.parse(localStorage.getItem('notifications') || '[]');
  saved.unshift({ title, body, time });
  if (saved.length > 50) saved.pop(); // عدد أقصى
  localStorage.setItem('notifications', JSON.stringify(saved));
};
