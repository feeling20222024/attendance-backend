// server.js (محدث - CORS ذكي)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin = require('firebase-admin');

// ----- تحقق من متغيرات البيئة المطلوبة -----
const {
  JWT_SECRET,
  SUPERVISOR_CODE,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_KEY,
  FIREBASE_SERVICE_ACCOUNT,
  APP_VERSION = '1.0.0'
} = process.env;

if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !GOOGLE_SERVICE_KEY || !FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ بعض متغيرات البيئة مفقودة (JWT_SECRET, SUPERVISOR_CODE, SHEET_ID, GOOGLE_SERVICE_KEY, FIREBASE_SERVICE_ACCOUNT)');
  process.exit(1);
}

// ----- تهيئة Firebase Admin -----
let serviceAccount;
try {
  serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
} catch (e) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT غير صالح:', e);
  process.exit(1);
}

// ----- دالة تحويل أرقام عربية/فارسية إلى لاتينية -----
function normalizeDigits(str) {
  if (!str) return '';
  return String(str).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    return String(code & 0xF);
  });
}

// ----- إعداد Google Sheets -----
let sheetCreds;
try { sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY); } 
catch (e) { console.error('❌ GOOGLE_SERVICE_KEY ليس JSON صالح:', e); process.exit(1); }

async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: sheetCreds.client_email,
    private_key: sheetCreds.private_key.replace(/\\n/g, '\n')
  });
  await doc.loadInfo();
  return doc;
}
async function readSheet(title) {
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) throw new Error(`Sheet "${title}" غير موجود`);
  await sheet.loadHeaderRow();
  const rawHeaders = sheet.headerValues.map(h => (h||'').toString().trim());
  const rows = await sheet.getRows();
  const data = rows.map(r => rawHeaders.map(h => r[h] != null ? r[h] : ''));
  return { headers: rawHeaders, data };
}

// ----- إعداد Express و CORS ذكي -----
const app = express();

// قائمة أوّلية مسموح بها (أضف حسب حاجتك)
const allowedOrigins = [
  'https://dwam-app-by-omar.netlify.app',
  'https://dwam-app-by-omar.onrender.com',
  'capacitor://localhost',
  'ionic://localhost',
  'http://localhost',
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'https://localhost'
];

// دالة origin ذكية
const corsOptions = {
  origin: function(origin, callback) {
    // تفعيل اختبار التوسع (سهل للتجربة): اضبط ALLOW_ALL_ORIGINS=1 في env
    if (process.env.ALLOW_ALL_ORIGINS === '1') {
      return callback(null, true);
    }
    // origin قد يكون undefined (native apps, curl) — اسمح بها
    if (!origin) return callback(null, true);
    // تحقق من التطابق الحرفي
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    // سمح بأي localhost مهما كان المنفذ
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    // capacitor/ionic schemes
    if (/^(capacitor|ionic):\/\/localhost$/.test(origin)) return callback(null, true);

    console.warn('CORS رفض Origin:', origin);
    return callback(new Error('CORS origin غير مسموح: ' + origin), false);
  },
  methods: ['GET','POST','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept'],
  exposedHeaders: ['Content-Length','X-Kuma-Revision'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ----- Middleware JWT -----
function authenticate(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    return next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ----- واجهات API (login, attendance, hwafez, tqeem, notifications, notify-all, register-token) -----

// login
app.post('/api/login', async (req, res) => {
  let { code, pass } = req.body || {};
  if (!code || !pass) return res.status(400).json({ error: 'code and pass required' });

  code = normalizeDigits(String(code).trim());
  pass = normalizeDigits(String(pass).trim());

  try {
    const { headers, data } = await readSheet('Users');
    const iC = headers.indexOf('كود الموظف');
    const iP = headers.indexOf('كلمة المرور');
    const iN = headers.indexOf('الاسم');

    const row = data.find(r => {
      const cellCode = normalizeDigits(String(r[iC] ?? '').trim());
      const cellPass = normalizeDigits(String(r[iP] ?? '').trim());
      return cellCode === code && cellPass === pass;
    });

    if (!row) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { code, name: row[iN] };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, user: payload });
  } catch (e) {
    console.error('login error:', e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// attendance (محمية)
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    const idxCode = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(String(req.user.code).trim());
    const userRows = data.filter(r => normalizeDigits(String(r[idxCode] ?? '').trim()) === target);

    // عامّة الملاحظات (إن كانت موجودة)
    const noteCol = headers.indexOf('تنبيهات وملاحظات عامة لجميع العاملين');
    const generalNote = (data.find(row => row[noteCol]) || [])[noteCol] || '';

    return res.json({ headers, data: userRows, generalNote });
  } catch (e) {
    console.error('attendance error:', e);
    return res.status(500).json({ error: e.message });
  }
});

// hwafez
app.get('/api/hwafez', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r => normalizeDigits(String(r[idx] ?? '').trim()) === target);
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error('hwafez error:', e);
    return res.status(500).json({ error: e.message });
  }
});

// tqeem
app.get('/api/tqeem', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('tqeem');
    const idx = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r => normalizeDigits(String(r[idx] ?? '').trim()) === target);
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error('tqeem error:', e);
    return res.status(500).json({ error: e.message });
  }
});

// إشعارات في الذاكرة (مثال)
const userNotifications = {};
app.get('/api/public-notifications', (req, res) => {
  // إرجاع آخر 50 إشعار عام
  res.json({ notifications: (userNotifications.__global__ || []).slice(0,50) });
});
app.get('/api/notifications', authenticate, (req, res) => {
  const personal = userNotifications[req.user.code] || [];
  const global = userNotifications.__global__ || [];
  const merged = [...personal, ...global].slice(0,50);
  return res.json({ notifications: merged });
});
app.post('/api/notifications', authenticate, (req, res) => {
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });
  const t = new Date().toISOString();
  userNotifications[req.user.code] = userNotifications[req.user.code] || [];
  userNotifications[req.user.code].unshift({ title, body, time: t });
  userNotifications.__global__ = userNotifications.__global__ || [];
  userNotifications.__global__.unshift({ title, body, time: t });
  if (userNotifications.__global__.length > 200) userNotifications.__global__.length = 200;
  return res.json({ success: true });
});

// notify-all (للمشرف فقط)
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (String(req.user.code) !== String(SUPERVISOR_CODE)) return res.status(403).json({ error: 'Forbidden' });
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });
  const t = new Date().toISOString();
  userNotifications.__global__ = userNotifications.__global__ || [];
  userNotifications.__global__.unshift({ title, body, time: t });
  return res.json({ success: true });
});

// اسم الإصدار + SPA fallback
app.get('/api/version', (_, res) => res.json({ version: APP_VERSION }));
app.get(/.*/, (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// بدء الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
