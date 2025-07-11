// —————————————————————————————————————————————————————————————
// Constants
const STORAGE_KEY     = 'notificationsLog';
const SUPERVISOR_CODE = '35190';

// —————————————————————————————————————————————————————————————
// قراءة الإشعارات من localStorage
function loadNotifications() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

// —————————————————————————————————————————————————————————————
// تحديث عداد الجرس
function updateBellCount() {
  const count = loadNotifications().length;
  const bellCount = document.getElementById('notifCount');
  if (!bellCount) return;
  bellCount.textContent = count;
  bellCount.style.display = count > 0 ? 'inline-block' : 'none';
}

// —————————————————————————————————————————————————————————————
// رسم محتوى لوحة الإشعارات
function renderNotifications() {
  const list = document.getElementById('notificationsLog');
  const clearB = document.getElementById('clearNotifications');
  const notifs = loadNotifications();

  if (!list || !clearB) return;

  list.innerHTML = '';

  if (notifs.length === 0) {
    list.innerHTML = '<li class="text-gray-500 text-sm">لا توجد إشعارات</li>';
  } else {
    notifs.forEach(n => {
      const li = document.createElement('li');
      li.className = 'mb-4 border-b pb-2';
      li.innerHTML = `
        <div class="font-semibold text-gray-800">${n.title}</div>
        <div class="text-sm text-gray-700">${n.body}</div>
        <div class="text-xs text-gray-400 mt-1">${n.time}</div>
      `;
      list.appendChild(li);
    });
  }

  // إظهار زر المسح للمشرف فقط
  if (window.currentUser === SUPERVISOR_CODE && notifs.length > 0) {
    console.log('🧪 Showing clear button for currentUser:', window.currentUser);
    clearB.classList.remove('hidden');
    clearB.style.display = 'inline-block';
  } else {
    console.log('🧪 Hiding clear button for currentUser:', window.currentUser);
    clearB.classList.add('hidden');
    clearB.style.display = 'none';
  }
}

// —————————————————————————————————————————————————————————————
// مسح سجل الإشعارات (للمشرف فقط)
// —————————————————————————————————————————————————————————————
// مسح سجل الإشعارات (للمشرف فقط)
function clearNotifications() {
  if (window.currentUser !== SUPERVISOR_CODE) {
    alert('ليس لديك صلاحية لمسح سجل الإشعارات.');
    return;
  }
  if (!confirm('هل أنت متأكد أنك تريد مسح جميع الإشعارات؟')) return;

  localStorage.removeItem(STORAGE_KEY);
  renderNotifications();
  updateBellCount();
}

// ★ إضافة Firestore: تخزين الإشعار في القاعدة ★
window.addNotification = async function(payload) {
  // 1) خزّن محليًا
  let saved = loadNotifications();
  saved.unshift({ title: payload.title, body: payload.body, time: payload.time });
  if (saved.length > 50) saved.pop();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));

  // 2) خزّن في Firestore (مجموعات notifications/userId)
  try {
    const userId = firebase.auth().currentUser.uid;
    await db
      .collection('notifications')
      .doc(userId)
      .collection('log')
      .add({
        title: payload.title,
        body: payload.body,
        time: payload.time,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
  } catch (e) {
    console.warn('Firestore save failed:', e);
  }

  // 3) إعادة رسم إذا اللوحة مفتوحة
  const panel = document.getElementById('notificationsPanel');
  if (panel && getComputedStyle(panel).display !== 'none') {
    renderNotifications();
  }
  updateBellCount();
};
