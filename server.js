// server.js (محدث - كامل وجاهز)
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin = require('firebase-admin');

// ------------ قراءة متغيرات البيئة الأساسية ------------
const {
  JWT_SECRET,
  SUPERVISOR_CODE,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_KEY,
  FIREBASE_SERVICE_ACCOUNT,
  APP_VERSION = '1.0.0',
  ALLOW_ALL_ORIGINS
} = process.env;

if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !GOOGLE_SERVICE_KEY || !FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ بعض متغيرات البيئة مفقودة. تأكد من ضبط JWT_SECRET, SUPERVISOR_CODE, GOOGLE_SHEET_ID, GOOGLE_SERVICE_KEY, FIREBASE_SERVICE_ACCOUNT');
  process.exit(1);
}

// ------------ تهيئة Firebase Admin ------------
let serviceAccount;
try {
  serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log('✅ Firebase Admin initialized');
} catch (e) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT غير صالح:', e);
  process.exit(1);
}

// ------------ دالة لتحويل الأرقام العربية/الفارسية إلى لاتينية ------------
function normalizeDigits(str) {
  if (!str) return '';
  return String(str).replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    return String(code & 0xF);
  });
}

// ------------ إعداد Google Sheets ------------
let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch (e) {
  console.error('❌ GOOGLE_SERVICE_KEY ليس JSON صالح:', e);
  process.exit(1);
}

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
  const rawHeaders = sheet.headerValues.map(h => (h || '').toString().trim());
  const rows = await sheet.getRows();
  const data = rows.map(r => rawHeaders.map(h => r[h] != null ? r[h] : ''));
  return { headers: rawHeaders, data };
}

// ------------ Express + CORS ذكي ------------
const app = express();

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

const corsOptions = {
  origin: function (origin, callback) {
    if (ALLOW_ALL_ORIGINS === '1') return callback(null, true);
    if (!origin) return callback(null, true); // native apps, curl, etc.
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    if (/^https?:\/\/localhost(:\d+)?$/.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return callback(null, true);
    if (/^(capacitor|ionic):\/\/localhost$/.test(origin)) return callback(null, true);
    console.warn('CORS refused origin:', origin);
    callback(new Error('CORS origin غير مسموح: ' + origin), false);
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  optionsSuccessStatus: 204
};

app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ------------ JWT middleware ------------
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

// ------------ Notifications & FCM helper (in-memory tokens) ------------
const tokens = new Map(); // token -> { userCode, createdAt }


// helper: صيغ وقت دمشق بدون ثواني
function damascusTimeString(ts = Date.now()) {
  return new Date(Number(ts)).toLocaleString('en-GB', {
    timeZone: 'Asia/Damascus',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

async function sendPushTo(token, title, body, data = {}) {
  const now = Date.now();
  const message = {
    token,
    notification: {
      title: String(title || '').slice(0, 200),
      body:  String(body  || '').slice(0, 1000)
    },
    // نضيف كل من الطابع الخام ونسخة منسقة بتوقيت دمشق داخل حقل data
    data: Object.assign({}, data, {
      ts: String(now),                 // epoch ms (خام)
      time: damascusTimeString(now)    // منسق بتوقيت دمشق، مثال: "2025-09-06 03:46"
    }),
    android: {
      priority: 'high',
      notification: { sound: 'default', channelId: 'default' }
    },
    apns: {
      headers: { 'apns-priority': '10' },
      payload: {
        aps: {
          alert: { title: String(title || ''), body: String(body || '') },
          sound: 'default',
          'content-available': 1
        }
      }
    },
    webpush: {
      headers: { Urgency: 'high' },
      notification: { title: String(title || ''), body: String(body || '') }
    }
  };

  try {
    const resp = await admin.messaging().send(message);
    console.log(`✅ sendPushTo success token=${token} resp=${resp}`);
    return { ok: true, resp };
  } catch (err) {
    console.error('❌ sendPushTo failed for token', token, err);
    // إزالة التوكن إن كان غير صالح
    if (err?.errorInfo?.code === 'messaging/registration-token-not-registered') {
      tokens.delete(token);
      try {
        await admin.firestore().collection('fcm_tokens').doc(token).delete().catch(()=>{});
      } catch(e){}
    }
    return { ok: false, error: err };
  }
}
// Endpoint لتسجيل توكن (يتوقع JWT مصدق)
app.post('/api/register-token', authenticate, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token required' });
  tokens.set(token, { userCode: req.user?.code || null, createdAt: new Date().toISOString() });

  // خيار: خزن في Firestore (اختياري)
  try {
    await admin.firestore().collection('fcm_tokens').doc(token).set({
      token,
      user: req.user || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    // غير حرج
    console.warn('failed to persist token to Firestore (non-fatal)', e.message || e);
  }

  res.json({ success: true });
});

// ------------ In-memory notifications storage (مثال) ------------
const userNotifications = {}; // userCode -> [{title,body,time}], __global__ for public

// ------------ API endpoints ------------

// login
app.post('/api/login', async (req, res) => {
  try {
    let { code, pass } = req.body || {};
    if (!code || !pass) return res.status(400).json({ error: 'code and pass required' });

    code = normalizeDigits(String(code).trim());
    pass = normalizeDigits(String(pass).trim());

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

// attendance (mprotected)
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');

    const idxCode = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(String(req.user.code).trim());

    // صفوف المستخدم
    const userRows = data.filter(r => normalizeDigits(String(r[idxCode] ?? '').trim()) === target);

    // ملاحظة عامة (كما عندك حالياً)
    const generalCol = headers.indexOf('تنبيهات وملاحظات عامة لجميع العاملين');
    const generalNote = (data.find(row => row[generalCol]) || [])[generalCol] || '';

    // محاولة إيجاد عمود الملاحظة الخاصة (مرن: يبحث بكلمة "خاص" أو "ملاحظة" إن لم يطابق الاسم تماماً)
    let personalNote = '';
    const possibleNames = [
      'تنبيهات وملاحظات خاصة بالعامل',
      'تنبيهات خاصة',
      'ملاحظات خاصة',
      'ملاحظات العامل',
      'تنبيهات وملاحظات خاصة'
    ];
    let personalCol = -1;
    for (const name of possibleNames) {
      personalCol = headers.indexOf(name);
      if (personalCol !== -1) break;
    }
    // لو لم نجد مباشرة، حاول بحث مرن باستخدام كلمة "خاص"
    if (personalCol === -1) {
      personalCol = headers.findIndex(h => typeof h === 'string' && /خاص|ملاحظات\s*خاصة/i.test(h));
    }

    if (personalCol !== -1) {
      // نبحث أول صف يخص هذا المستخدم ويحتوي الملاحظة الخاصة
      const rowWithPersonal = data.find(r =>
        normalizeDigits(String(r[idxCode] ?? '').trim()) === target && (r[personalCol] || '').toString().trim() !== ''
      );
      if (rowWithPersonal) personalNote = rowWithPersonal[personalCol] || '';
    }

    // أرجع كل شيء (مواكب لواجهة العميل التي تتوقع generalNote و personalNote)
    return res.json({ headers, data: userRows, generalNote, personalNote });
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

// public notifications (قبل login)
app.get('/api/public-notifications', (req, res) => {
  if (!userNotifications.__global__ || userNotifications.__global__.length === 0) {
    // إشعارات افتراضية تظهر دائماً
    return res.json({
      notifications: [
        { title: "📢 تنبيه", body: "سجل الدخول أولاً لرؤية الإشعارات", time: new Date().toISOString() },
    
      ]
    });
  }

  res.json({ notifications: (userNotifications.__global__ || []).slice(0, 50) });
});


// get personal notifications (requires auth)
app.get('/api/notifications', authenticate, (req, res) => {
  const personal = userNotifications[req.user.code] || [];
  const global = userNotifications.__global__ || [];
  const merged = [...personal, ...global].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 50);
  res.json({ notifications: merged });
});

// post personal notification (for testing / storing)
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

// notify-all (supervisor only) -> send push to all tokens + store in memory
app.post('/api/notify-all', authenticate, async (req, res) => {
  try {
    if (String(req.user.code) !== String(SUPERVISOR_CODE)) return res.status(403).json({ error: 'Forbidden' });
    const { title, body } = req.body || {};
    if (!title || !body) return res.status(400).json({ error: 'title and body required' });

    const t = new Date().toISOString();
    userNotifications.__global__ = userNotifications.__global__ || [];
    userNotifications.__global__.unshift({ title, body, time: t });

    const tokenList = Array.from(tokens.keys());
    const results = await Promise.allSettled(tokenList.map(tkn => sendPushTo(tkn, title, body)));
    const failed = results.reduce((acc, r, i) => {
      if (r.status === 'rejected' || (r.status === 'fulfilled' && !r.value?.ok)) acc.push(tokenList[i]);
      return acc;
    }, []);
    failed.forEach(tk => tokens.delete(tk));

    return res.json({ success: true, sent: tokenList.length - failed.length, failed: failed.length });
  } catch (e) {
    console.error('notify-all error:', e);
    return res.status(500).json({ error: 'notify failed' });
  }
});

// delete notifications (supervisor) - clears memory
app.delete('/api/notifications', authenticate, (req, res) => {
  if (String(req.user.code) !== String(SUPERVISOR_CODE)) return res.status(403).json({ error: 'Forbidden' });
  Object.keys(userNotifications).forEach(k => delete userNotifications[k]);
  userNotifications.__global__ = [];
  return res.json({ success: true });
});

// version
app.get('/api/version', (req, res) => res.json({ version: APP_VERSION }));

// SPA fallback (serve index.html from public)
app.get(/.*/, (_, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
