// notifications.js
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const SUPERVISOR_CODE = window.SUPERVISOR_CODE || '35190';
window.serverNotifications = [];

// حاول تحميل ما في localStorage إن وُجد (اختياري)
try {
  window.serverNotifications = JSON.parse(localStorage.getItem('serverNotifications') || '[]') || [];
} catch (e) {
  window.serverNotifications = [];
}
function persistNotifications() {
  try {
    localStorage.setItem('serverNotifications', JSON.stringify(window.serverNotifications));
  } catch (e) { /* ignored */ }
}

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

function renderNotifications() {
  const list  = document.getElementById('notificationsLog');
  const badge = document.getElementById('notifCount');
  const clear = document.getElementById('clearNotifications');
  if (!list || !badge || !clear) return;

  list.innerHTML = '';
  if (!window.serverNotifications || !window.serverNotifications.length) {
    list.innerHTML = '<li class="text-gray-500">لا توجد إشعارات</li>';
    badge.classList.add('hidden');
  } else {
    window.serverNotifications.slice(0,50).forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-2 border-b pb-1';
      const timeStr = formatDamascus(n.timestamp || n.time || Date.now());
      li.innerHTML = `<strong>${n.title}</strong><br>
        <small>${n.body}</small><br>
        <small class="text-gray-400">${timeStr}</small>`;
      list.appendChild(li);
    });
    badge.textContent = String(window.serverNotifications.length);
    badge.classList.remove('hidden');
  }

  clear.style.display =
    (String(window.currentUser) === String(SUPERVISOR_CODE) && window.serverNotifications.length)
      ? 'block' : 'none';
}

window.addNotification = ({ title, body, timestamp }) => {
  const now = timestamp || Date.now();
  const arr = window.serverNotifications || [];
  if (arr[0] && arr[0].title === title && arr[0].body === body) return;
  arr.unshift({ title, body, timestamp: now });
  if (arr.length > 50) arr.length = 50;
  window.serverNotifications = arr;
  persistNotifications();
  renderNotifications();
};

function mergeUnique(existing, incoming) {
  const seen = new Set(existing.map(n => `${n.title}|${n.body}|${n.timestamp || n.time || ''}`));
  incoming.forEach(n => {
    const key = `${n.title}|${n.body}|${n.timestamp || n.time || ''}`;
    if (!seen.has(key)) {
      existing.unshift({
        title: n.title,
        body: n.body,
        timestamp: n.timestamp || n.time || Date.now()
      });
      seen.add(key);
    }
  });
  // keep max 50
  if (existing.length > 50) existing.length = 50;
  return existing;
}

// جلب الإشعارات العامة من الخادم (لا تحتاج JWT)
async function fetchPublicNotifications() {
  try {
    const res = await fetch(`${API_BASE}/public-notifications`);
    if (!res.ok) return;
    const json = await res.json();
    const publicList = Array.isArray(json.notifications) ? json.notifications.map(n => ({
      title: n.title || '',
      body: n.body ||
