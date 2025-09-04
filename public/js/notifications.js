const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';
window.serverNotifications = [];

// حاول تحميل ما في localStorage إن وُجد (اختياري)
window.serverNotifications = JSON.parse(localStorage.getItem('serverNotifications') || '[]');
function persistNotifications() {
  localStorage.setItem('serverNotifications', JSON.stringify(window.serverNotifications));
}

// ===== دالة تحويل التوقيت إلى توقيت دمشق بدون ثواني =====
function formatDamascus(timestamp) {
  const t = (typeof timestamp === 'number') ? timestamp
          : (typeof timestamp === 'string' && /^\d+$/.test(timestamp)) ? Number(timestamp)
          : Date.parse(timestamp) || Date.now();
  const date = new Date(t);
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Damascus',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false
    });
    const parts = fmt.formatToParts(date);
    const map = {};
    parts.forEach(p => { if (p.type !== 'literal') map[p.type] = p.value; });
    const Y = map.year || String(date.getUTCFullYear());
    const M = map.month || String(date.getUTCMonth() + 1).padStart(2, '0');
    const D = map.day || String(date.getUTCDate()).padStart(2, '0');
    const H = map.hour || String(date.getUTCHours()).padStart(2, '0');
    const Min = map.minute || String(date.getUTCMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${H}:${Min}`;
  } catch (e) {
    const d = new Date(date.getTime() + 3 * 60 * 60 * 1000);
    const Y = d.getUTCFullYear();
    const M = String(d.getUTCMonth() + 1).padStart(2, '0');
    const D = String(d.getUTCDate()).padStart(2, '0');
    const H = String(d.getUTCHours()).padStart(2, '0');
    const Min = String(d.getUTCMinutes()).padStart(2, '0');
    return `${Y}-${M}-${D} ${H}:${Min}`;
  }
}

// ===== رسم الإشعارات =====
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
      const timeStr = formatDamascus(n.timestamp || n.time || Date.now());
      li.innerHTML = `<strong>${n.title}</strong><br
