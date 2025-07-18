// public/js/notifications.js
(function(){
  // —————————————————————————————————————————
  // منع تسجيل الـ listener أكثر من مرة
  // —————————————————————————————————————————
  if (window._firebaseOnMessageRegistered) return;
  window._firebaseOnMessageRegistered = true;

  // —————————————————————————————————————————
  // 0) تهيئة Firebase (Compat SDK)
  // تأكد أن هذه السكربتات محمّلة في HTML قبل هذا الملف:
  //   <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js" defer></script>
  //   <script src="https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js" defer></script>
  // —————————————————————————————————————————
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

  // —————————————————————————————————————————
  // 1) مفتاح التخزين في localStorage
  // —————————————————————————————————————————
  const STORAGE_KEY = 'notificationsLog';

  // —————————————————————————————————————————
  // 2) تحميل الإشعارات من localStorage
  // —————————————————————————————————————————
  function loadNotifications() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  }

  // —————————————————————————————————————————
  // 3) تحديث العداد على أيقونة الجرس
  // —————————————————————————————————————————
  function updateBellCount() {
    const count = loadNotifications().length;
    const bellCount = document.getElementById('notifCount');
    if (!bellCount) return;
    bellCount.textContent = count;
    bellCount.style.display = count > 0 ? 'inline-block' : 'none';
  }

  // —————————————————————————————————————————
  // 4) رسم لوحة الإشعارات
  // —————————————————————————————————————————
  function renderNotificationsPanel() {
    const notifs = loadNotifications();
    const list   = document.getElementById('notificationsLog');
    const clearB = document.getElementById('clearNotifications');
    if (!list || !clearB) return;

    list.innerHTML = '';
    if (notifs.length === 0) {
      list.innerHTML = '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';
      clearB.classList.add('hidden');
    } else {
      notifs.forEach(n => {
        const li = document.createElement('li');
        li.className = 'mb-2 border-b pb-2';
        li.innerHTML = `
          <div class="font-semibold text-gray-800">${n.title}</div>
          <div class="text-sm text-gray-700">${n.body}</div>
          <div class="text-xs text-gray-400 mt-1">${n.time}</div>
        `;
        list.appendChild(li);
      });
      clearB.classList.remove('hidden');
    }
  }

  // —————————————————————————————————————————
  // 5) مسح سجل الإشعارات
  // —————————————————————————————————————————
  function clearNotifications() {
    if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;
    localStorage.removeItem(STORAGE_KEY);
    renderNotificationsPanel();
    updateBellCount();
  }

  // —————————————————————————————————————————
  // 6) إضافة إشعار جديد في السجل مع منع التكرار المزدوج
  // —————————————————————————————————————————
  function addNotificationToLog(title, body) {
    const now   = new Date().toLocaleString();
    const saved = loadNotifications();
    // إذا كان الإشعار نفسه في أول القائمة، لا نضيفه مجدداً
    if (saved.length && saved[0].title === title && saved[0].body === body) {
      return;
    }
    saved.unshift({ title, body, time: now });
    if (saved.length > 50) saved.pop();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    updateBellCount();
    const panel = document.getElementById('notificationsPanel');
    if (panel && panel.style.display === 'block') {
      renderNotificationsPanel();
    }
  }

  // ★ إتاحة الدوال للعالم الخارجي ★
  window.addNotification = ({ title, body }) => addNotificationToLog(title, body);

  // —————————————————————————————————————————
  // 7) تسجيل listener واحد فقط لـ onMessage
  // —————————————————————————————————————————
  messaging.onMessage(payload => {
    const { title, body } = payload.notification || {};
    if (title && body) {
      addNotificationToLog(title, body);
    }
  });

  // —————————————————————————————————————————
  // 8) ربط الأحداث عند تحميل DOM
  // —————————————————————————————————————————
  document.addEventListener('DOMContentLoaded', () => {
    const bell   = document.getElementById('notifBell');
    const panel  = document.getElementById('notificationsPanel');
    const clearB = document.getElementById('clearNotifications');

    updateBellCount();
    renderNotificationsPanel();

    // فتح/غلق اللوحة عند الضغط على الجرس
    bell.addEventListener('click', () => {
      renderNotificationsPanel();
      updateBellCount();
      panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    });

    // مسح سجل الإشعارات
    clearB.addEventListener('click', clearNotifications);

    // فتح/إغلاق مودال "متطلبات البرنامج" (إن وُجد)
    const reqBtn   = document.getElementById('requirementsBtn');
    const modal    = document.getElementById('requirementsModal');
    const closeBtn = document.getElementById('closeRequirements');
    if (reqBtn && modal && closeBtn) {
      reqBtn.addEventListener('click', () => modal.classList.remove('hidden'));
      closeBtn.addEventListener('click', () => modal.classList.add('hidden'));
      modal.addEventListener('click', e => {
        if (e.target === modal) modal.classList.add('hidden');
      });
    }
  });
})();
