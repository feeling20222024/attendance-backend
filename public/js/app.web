// public/js/app.web.js
// —————————————————————————————————————————
// Helper: تطبيع أرقام عربية → غربية
function normalizeDigits(str) {
  return str.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

// دالة إشعارات الويب فقط
window.initPush = () => {
  Notification.requestPermission().then(p => {
    if (p === 'granted') console.log('📢 إشعارات الويب مفعلة');
  });
};

// دوال تسجيل الدخول وجلب البيانات (كما هي عندك حالياً)
const API_BASE       = 'https://dwam-app-by-omar.onrender.com/api';
const LOGIN_ENDPOINT = `${API_BASE}/login`;
let jwtToken = null, currentUser = null;

async function loginWeb() {
  const code = normalizeDigits(document.getElementById('codeInput').value.trim());
  const pass = document.getElementById('passwordInput').value.trim();
  if (!code || !pass) return alert('يرجى إدخال الكود وكلمة المرور.');

  const res = await fetch(LOGIN_ENDPOINT, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({code,pass})
  });
  if (res.status===401) return alert('بيانات الدخول خاطئة');
  if (!res.ok) throw new Error(`خطأ بالخادم (${res.status})`);

  const {token,user} = await res.json();
  jwtToken = token;
  localStorage.setItem('jwtToken',token);
  currentUser = user.code ?? user['كود الموظف'];
  console.log('✅ loginWeb:', currentUser);

  // إشعارات المتصفح
  window.initPush();

  await fetchAndRender();
}

// ربط الأزرار
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginBtn').onclick = loginWeb;
  // باقي الأزرار كما في app.js القديم...
});
