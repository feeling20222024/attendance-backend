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
  }

  // فتح/غلق اللوحة عند الضغط على الجرس (مُتاح بعد login)
  bell.addEventListener('click', () => {
    if (!window.currentUser) return;      // لا يفتح قبل login
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    // عند الفتح، لا نحذف سجل الإشعارات، لكن نصفر العداد
    if (panel.style.display === 'block') {
      count.textContent = '0';
    }
  });

  // زر المسح يظهر فقط للمشرف
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

  // في كل مرة تُستدعى initNotifications، أعد العرض
  render();
};

window.addNotificationToLog = ({ title, body, time }) => {
  // نقرأ السجل الحالي من localStorage
  const existing = JSON.parse(localStorage.getItem('notificationsLog') || '[]');
  // نضيف الإشعار الجديد في رأس القائمة
  existing.unshift({ title, body, time });
  // نحافظ على أقصى عدد (مثلاً 50)
  if (existing.length > 50) existing.pop();
  // نعيد تخزين السجل
  localStorage.setItem('notificationsLog', JSON.stringify(existing));
};
