// server.js (مُصحَّح كامل)
require('dotenv').config();

const express               = require('express');
const cors                  = require('cors');
const path                  = require('path');
const jwt                   = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin                 = require('firebase-admin');
const { getFirestore }      = require('firebase-admin/firestore');

// 2) تهيئة Firebase Admin
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (err) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT غير صالح أو غير موجود في الـ env.');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = getFirestore();

// 3) إنشاء التطبيق وإعداد CORS
const app = express();

// ---------------------
// --- استبدل تعريف corsOptions الحالي بهذا ---
const allowedOrigins = [
  'https://dwam-app-by-omar.netlify.app',
  'https://dwam-app-by-omar.onrender.com',
  'capacitor://localhost',
  'http://localhost',
  'http://localhost:8100',
  'http://127.0.0.1:5500',
  'ionic://localhost'
];

const corsOptions = {
  origin: function(origin, callback) {
    // origin قد يكون undefined في بعض الـ native apps أو curl
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);

    // للـ development: اقبل أي origin لو NODE_ENV !== 'production'
    if (process.env.NODE_ENV !== 'production') return callback(null, true);

    return callback(new Error('الـ CORS origin غير مسموح: ' + origin), false);
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 4) إعدادات عامة
const APP_VERSION        = process.env.APP_VERSION        || '1.0.0';
const PORT               = process.env.PORT               || 3000;
const JWT_SECRET         = process.env.JWT_SECRET;
const SUPERVISOR_CODE    = process.env.SUPERVISOR_CODE;
const SHEET_ID           = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_KEY = process.env.GOOGLE_SERVICE_KEY;

if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !GOOGLE_SERVICE_KEY) {
  console.error('❌ بعض متغيرات البيئة مفقودة.');
  process.exit(1);
}

// 5) تطبيع الأرقام عربية→غربية
function normalizeDigits(str) {
  if (!str) return '';
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    return String(code & 0xF);
  });
}

// 6) إعداد Google Sheets (دوال مساعدة)
let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch {
  console.error('❌ GOOGLE_SERVICE_KEY ليس JSON صالح.');
  process.exit(1);
}

async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: sheetCreds.client_email,
    private_key:  sheetCreds.private_key.replace(/\\n/g, '\n')
  });
  await doc.loadInfo();
  return doc;
}

async function readSheet(title) {
  const doc   = await accessSheet();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) throw new Error(`Sheet "${title}" غير موجود`);
  await sheet.loadHeaderRow();

  const rawHeaders   = sheet.headerValues;
  const cleanHeaders = rawHeaders.map(h => h.trim());
  const rows = await sheet.getRows();
  const data = rows.map(r =>
    cleanHeaders.map(h => r[h] != null ? r[h] : '')
  );

  return { headers: cleanHeaders, data };
}

// 7) JWT Middleware
function authenticate(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// -------------------------
// توقيت دمشق: دالة تنسيق (بدون ثواني)
// -------------------------
function formatDamascus(dateInput) {
  const date = (dateInput instanceof Date) ? dateInput : new Date(dateInput || Date.now());
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Damascus',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit',
      hour12: false
    }).formatToParts(date);
    const m = {};
    parts.forEach(p => { if (p.type !== 'literal') m[p.type] = p.value; });
    const Y = m.year, M = m.month, D = m.day, H = m.hour, Min = m.minute;
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

// -------------------------
// إشعارات: الذاكرة + Firestore
// -------------------------
const tokens = new Map();
const userNotifications = {};
const globalNotifications = [];

async function deleteTokenFromFirestore(docId) {
  try {
    await db.collection('fcm_tokens').doc(docId).delete();
    console.log(`🗑️ Deleted token doc ${docId} from Firestore`);
  } catch (e) {
    console.warn('⚠️ deleteTokenFromFirestore failed', e);
  }
}

async function sendPushTo(token, title, body, data = {}) {
  const message = {
    token,
    notification: { title, body },
    android: { ttl: 48 * 60 * 60 * 1000, priority: 'high' },
    data
  };
  try {
    await admin.messaging().send(message);
    console.log(`✅ تم الإرسال بنجاح إلى ${token}`);
  } catch (err) {
    console.error(`❌ فشل الإرسال إلى ${token}:`, err);
    tokens.delete(token);
    if (err?.errorInfo?.code === 'messaging/registration-token-not-registered') {
      console.warn(`🗑️ حذف التوكن غير الصالح: ${token}`);
      await deleteTokenFromFirestore(token);
    }
  }
}

// -------------------------
// نقاط النهاية (login, register-token, notify-all, notifications ...)
// -------------------------
app.post('/api/login', cors(corsOptions), async (req, res) => {
  let { code, pass } = req.body;
  if (!code || !pass) {
    return res.status(400).json({ error: 'code and pass required' });
  }

  code = normalizeDigits(code.trim());
  pass = normalizeDigits(pass.trim());

  try {
    const { headers, data } = await readSheet('Users');
    const iC = headers.indexOf('كود الموظف');
    const iP = headers.indexOf('كلمة المرور');
    const iN = headers.indexOf('الاسم');

    const row = data.find(r =>
      normalizeDigits((r[iC] || '').trim()) === code &&
      normalizeDigits((r[iP] || '').trim()) === pass
    );

    if (!row) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { code, name: row[iN] };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

    res.json({ token, user: payload });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// بقية الـ endpoints (نسختك الأصلية) — احتفظ بها كما هي...
// ... (register-token, notify-all, notifications, public-notifications, delete notifications, version, SPA fallback)

app.get('/api/version', (_, res) => res.json({ version: APP_VERSION }));
app.get(/.*/, (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
