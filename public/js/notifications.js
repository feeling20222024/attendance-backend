window.initNotifications = function () {
  const bell = document.getElementById('notifBell');
  const panel = document.getElementById('notificationsPanel');
  const list = document.getElementById('notificationsLog');
  const count = document.getElementById('notifCount');
  const clearB = document.getElementById('clearNotifications');

  function render() {
    const saved = JSON.parse(localStorage.getItem('notifications') || '[]');
    console.log('🧪 render() | notifications:', saved);

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

      // تصحيح شرط إظهار زر المسح
      if (typeof window.currentUser !== 'undefined' && String(window.currentUser) === '35190') {
        clearB.classList.remove('hidden');
      } else {
        clearB.classList.add('hidden');
      }
    }
  }

  // زر المسح
  clearB.addEventListener('click', () => {
    if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
    localStorage.removeItem('notifications');
    render();
  });

  // رسم فوري
  render();

  // تبديل ظهور اللوحة عند الضغط على الجرس
  bell.addEventListener('click', () => {
    const isHidden = panel.classList.contains('hidden');
    if (isHidden) {
      panel.classList.remove('hidden');
      panel.style.display = 'block';
    } else {
      panel.classList.add('hidden');
      panel.style.display = 'none';
    }
  });
};
