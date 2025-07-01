// —————————————————————————————————————————
// دالة تهيئة واجهة لوحة الإشعارات
// —————————————————————————————————————————
window.initNotifications = function() {
  const bell   = document.getElementById('notifBell');
  const panel  = document.getElementById('notificationsPanel');
  const ul     = document.getElementById('notificationsLog');
  const count  = document.getElementById('notifCount');
  const clearB = document.getElementById('clearNotifications');

  // إعادة عرض الإشعارات المخزّنة
  function render() {
    const saved = JSON.parse(localStorage.getItem('notifications') || '[]');
    ul.innerHTML = '';
    saved.forEach(n => {
      const li = document.createElement('li');
      li.style.padding = '0.5rem 0';
      li.innerHTML = `
        <strong>${n.title}</strong><br>
        ${n.body}<br>
        <small>📅 ${n.time}</small>
        <hr style="margin:0.5rem 0">
      `;
      ul.appendChild(li);
    });
    count.textContent = saved.length;
    count.style.display = saved.length > 0 ? 'inline-block' : 'none';
  }

  // عند الضغط على الجرس: فتح/غلق اللوحة
  bell.addEventListener('click', () => {
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
  });

  // إظهار زر المسح فقط للمشرف بعد login
  if (window.currentUser === '35190') {
    clearB.style.display = 'block';
    clearB.addEventListener('click', () => {
      if (confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) {
        localStorage.removeItem('notifications');
        render();
        alert('✅ تم مسح الإشعارات بنجاح');
      }
    });
  } else {
    clearB.style.display = 'none';
  }

  // عرض السجل فور التهيئة
  render();
};

// استدعاء initNotifications عند تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  window.initNotifications();
});
