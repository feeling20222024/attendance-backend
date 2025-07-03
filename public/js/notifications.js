// notifications.js

window.initNotifications = function retryableInit() {
  const bell   = document.getElementById('notifBell');
  const panel  = document.getElementById('notificationsPanel');
  const list   = document.getElementById('notificationsLog');
  const count  = document.getElementById('notifCount');
  const clearB = document.getElementById('clearNotifications');

  // ✅ تأكد من أن كل العناصر موجودة، وإن لم تكن، أعد المحاولة بعد 300 مللي ثانية
  if (!bell || !panel || !list || !count || !clearB) {
    console.warn('🔁 عناصر الإشعارات غير جاهزة بعد. إعادة المحاولة...');
    setTimeout(window.initNotifications, 300);
    return;
  }

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
      if (window.currentUser === '35190') clearB.classList.remove('hidden');
      else clearB.classList.add('hidden');
    }
  }

  clearB.addEventListener('click', () => {
    if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
    localStorage.removeItem('notifications');
    render();
  });

  render();

  bell.addEventListener('click', () => {
    panel.classList.toggle('hidden');
  });
};

// ✅ دالة تُستخدم من push.js لحفظ الإشعار
window.addNotification = function({ title, body, time }) {
  const saved = JSON.parse(localStorage.getItem('notifications') || '[]');
  saved.unshift({ title, body, time });
  if (saved.length > 50) saved.pop();
  localStorage.setItem('notifications', JSON.stringify(saved));
};
