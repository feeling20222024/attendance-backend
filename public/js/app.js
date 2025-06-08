// js/app.js
// —————————————————————————————————————————
//  إعداد نقاط النهاية والمتغيرات العامة
// —————————————————————————————————————————
const API_BASE        = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT  = `${API_BASE}/login`;
const SUPERVISOR_CODE = '35190';

let jwtToken    = null;
let currentUser = null;
let headersAtt, attendanceData;
let headersHw, hwafezData;

const caseMapping = {
  '1': "غياب غير مبرر (بدون إذن رسمي)",
  '2': "تأخر أكثر من ساعة أو عدم مهر البصمة صباحاً",
  '3': "خروج مبكر (أو عدم مهر البصمة مساءً)",
  '4': "عدد مرات التأخر أقل من ساعة (حسم يوم كل 3 تأخيرات)",
  '5': "تجميع ساعيات (كل ثماني ساعات يتم احتساب يوم)"
};

function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

// إشعارات الويب
window.initPush = () => {
  if (!("Notification" in window)) return;
  Notification.requestPermission().then(p => {
    if (p === "granted") console.log('📢 إشعارات الويب مفعلة');
  });
};

document.addEventListener('DOMContentLoaded', async () => {
  // بنينا DOMContentLoaded لأنه الآن لن يفشل التحميل بسبب import غير مدعوم
  document.getElementById('loginBtn').onclick  = login;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('aboutBtn').onclick  = () =>
    alert('فكرة وإعداد وتصميم عمر عوني الماضي – دائرة الموارد البشرية – اتصالات دمشق');
  document.getElementById('hwafezBtn').onclick = showHwafez;

  // إذا كان هناك توكن محفوظ، نحاول استعادة الجلسة تلقائياً
  const saved = localStorage.getItem('jwtToken');
  if (saved) {
    jwtToken = saved;
    await fetchAndRender().catch(logout);
  }
});

async function login() {
  const rawCode = document.getElementById('codeInput').value.trim();
  const code    = normalizeDigits(rawCode);
  const pass    = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) return alert('يرجى إدخال الكود وكلمة المرور.');

  try {
    const res = await fetch(LOGIN_ENDPOINT, {
      method: 'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ code, pass })
    });
    if (res.status === 401) return alert('بيانات الدخول خاطئة');
    if (!res.ok) throw new Error(`فشل تسجيل الدخول (${res.status})`);

    const { token, user } = await res.json();
    jwtToken = token;
    localStorage.setItem('jwtToken', token);

    // مهم جداً: نزود window.currentUser قبل استدعاء initPush/initNativePush
    currentUser = user.code ?? user['كود الموظف'];
    window.currentUser = currentUser;
    console.log('✅ login successful, currentUser =', currentUser);

    if (window.Capacitor && Capacitor.getPlatform() !== 'web') {
      await initNativePush();
    } else {
      window.initPush();
    }

    await fetchAndRender();
  } catch (e) {
    console.error('❌ login error:', e);
    alert('حدث خطأ أثناء تسجيل الدخول');
  }
}

async function initNativePush() {
  try {
    // استيراد ديناميكي فقط هنا
    const { PushNotifications } = await import('@capacitor/push-notifications');

    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') {
      console.warn('لم يتم منح إذن إشعارات الجوال');
      return;
    }
    await PushNotifications.register();

    PushNotifications.addListener('registration', async t => {
      console.log('✅ FCM mobile token:', t.value);
      await fetch(`${API_BASE}/register-token`, {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':`Bearer ${jwtToken}`
        },
        body: JSON.stringify({ user: currentUser, token: t.value })
      });
    });

    PushNotifications.addListener('pushNotificationReceived', n => console.log('📩', n));
    PushNotifications.addListener('pushNotificationActionPerformed', a => console.log('📲', a));
  } catch (e) {
    console.warn('❌ initNativePush error:', e);
  }
}

// بقية الدوال (fetchAndRender، renderRecords، showHwafez، sendSupervisorNotification، logout)
// تبقى كما في المثال السابق دون تغييرٍ جوهريّ
// …
// يمكنك نسخ بقية الكود من الإصدار الأخير الذي أرسلته لك أعلاه …
