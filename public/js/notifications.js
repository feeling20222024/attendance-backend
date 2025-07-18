// public/js/notifications.js

// —————————————————————————————————————————
// 0) تهيئة Firebase (Compat SDK)
// تأكد أن هذه السكربتات محمّلة في HTML قبل هذا الملف:
//   <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js" defer></script>
//   <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js" defer></script>
// —————————————————————————————————————————

// 1) initializeApp يجب أن يكون أول شيء:
const firebaseConfig = {
  apiKey:            "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:        "device-streaming-47cbe934.firebaseapp.com",
  projectId:         "device-streaming-47cbe934",
  storageBucket:     "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId:             "1:235398312189:web:8febe5e63f7b134b808e94"
};
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

(function(){
  const STORAGE_KEY = 'notificationsLog';

  function loadNotifications() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
    catch { return []; }
  }

  function updateBellCount() {
    const count = loadNotifications().length;
    const badge = document.getElementById('notifCount');
    if (!badge) return;
    badge.textContent = count;
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }

  function addNotificationToLog(title, body) {
    const now   = new Date().toLocaleString();
    const saved = loadNotifications();
    // منع التكرار
    if (saved[0]?.title === title && saved[0]?.body === body) return;
    saved.unshift({ title, body, time: now });
    if (saved.length > 50) saved.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    updateBellCount();
    const panel = document.getElementById('notificationsPanel');
    if (panel?.style.display === 'block') renderNotificationsPanel();
  }

  function renderNotificationsPanel() {
    const notifs = loadNotifications();
    const list   = document.getElementById('notificationsLog');
    const clearB = document.getElementById('clearNotifications');
    if (!list || !clearB) return;

    if (notifs.length === 0) {
      list.innerHTML = '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';
      clearB.classList.add('hidden');
    } else {
      list.innerHTML = notifs.map(n => `
        <li class="mb-2 border-b pb-2">
          <div class="font-semibold text-gray-800">${n.title}</div>
          <div class="text-sm text-gray-700">${n.body}</div>
          <div class="text-xs text-gray-400 mt-1">${n.time}</div>
        </li>
      `).join('');
      clearB.classList.remove('hidden');
    }
  }

  function clearNotifications() {
    if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
    localStorage.removeItem(STORAGE_KEY);
    renderNotificationsPanel();
    updateBellCount();
  }

  // ★ إتاحة دوال السجل للعالم الخارجي ★
  window.addNotification = ({ title, body }) => addNotificationToLog(title, body);

  document.addEventListener('DOMContentLoaded', () => {
    // 1) ربط زر الجرس
    document.getElementById('notifBell')
      .addEventListener('click', () => {
        const panel = document.getElementById('notificationsPanel');
        panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
        if (panel.style.display === 'block') renderNotificationsPanel();
      });

    // 2) ربط زر المسح
    document.getElementById('clearNotifications')
      .addEventListener('click', clearNotifications);

    // 3) تهيئة العداد واللوحة مباشرة عند التحميل
    updateBellCount();
    renderNotificationsPanel();

    // 4) تسجيل listener وحيد للرسائل الواردة
    messaging.onMessage(payload => {
      const { title, body } = payload.notification || {};
      if (title && body) addNotificationToLog(title, body);
    });
  });
})();
