const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';

// نقرأ التخزين السابق (أو نعطي مصفوفة فارغة إن لم يوجد)
window.serverNotifications = JSON.parse(
  localStorage.getItem('serverNotifications') || '[]'
);

// دالة لمزامنة الـ localStorage
function persistNotifications() {
  localStorage.setItem(
    'serverNotifications',
    JSON.stringify(window.serverNotifications)
  );
}

// رسم الإشعارات
function renderNotifications() {
  const list  = document.getElementById('notificationsLog');
  const badge = document.getElementById('notifCount');
  const clear = document.getElementById('clearNotifications');
  if (!list || !badge || !clear) return;

  list.innerHTML = '';
  if (!window.serverNotifications.length) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    badge.classList.add('hidden');
  } else {
    window.serverNotifications.slice(0,50).forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-1';
      const timeStr = new Date(n.timestamp).toLocaleString('ar-EG',{
        dateStyle:'short', timeStyle:'short'
      });
      li.innerHTML = `<strong>${n.title}</strong><br>
        <small>${n.body}</small><br>
        <small class="text-gray-400">${timeStr}</small>`;
      list.appendChild(li);
    });
    badge.textContent = window.serverNotifications.length;
    badge.classList.remove('hidden');
  }

  clear.style.display = 
    (window.currentUser === SUPERVISOR_CODE && window.serverNotifications.length)
      ? 'block' : 'none';
}

// إضافة إشعار جديد
window.addNotification = ({title, body, timestamp}) => {
  const now = timestamp||Date.now();
  const arr = window.serverNotifications;
  if (arr[0]?.title===title && arr[0]?.body===body) return;
  arr.unshift({title, body, timestamp: now});
  window.serverNotifications = arr.slice(0,50);
  persistNotifications();     // ← مزامنة الـ localStorage
  renderNotifications();
};

// جلب سجل الإشعارات من الخادم (إذا سجل المستخدم)
window.openNotificationLog = async () => {
  if (window.jwtToken) {
    try {
      const res = await fetch(`${API_BASE}/notifications`, {
        headers:{Authorization:`Bearer ${window.jwtToken}`}
      });
      if (res.ok) {
        const {notifications} = await res.json();
        window.serverNotifications = notifications||[];
        persistNotifications(); // ← عملية مزامنة جديدة
      }
    } catch{/*ignore*/}
  }
  renderNotifications();
};

// ربط زر الجرس والعداد بعد التحميل
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('notificationsPanel');
  const bell  = document.getElementById('notifBell');
  const clear = document.getElementById('clearNotifications');
  if (!panel||!bell) return;

  panel.addEventListener('click', e=>e.stopPropagation());
  bell.addEventListener('click', async e=>{
    e.stopPropagation();
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden')) {
      await openNotificationLog();
    }
  });
  document.body.addEventListener('click', ()=>panel.classList.add('hidden'));
  clear.addEventListener('click', async e=>{
    e.stopPropagation();
    if (window.currentUser!==SUPERVISOR_CODE) return;
    if (!confirm('هل أنت متأكد من مسح جميع الإشعارات؟')) return;
    await fetch(`${API_BASE}/notifications`,{
      method:'DELETE',
      headers:{Authorization:`Bearer ${window.jwtToken}`}
    });
    window.serverNotifications=[];
    persistNotifications();  // ← مزامنة بعد المسح
    renderNotifications();
  });

  // نعرض ما في التخزين حتى قبل التسجيل
  renderNotifications();
});
