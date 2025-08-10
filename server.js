// server.js — مُحدّث (CORS مرن وآمن افتراضياً)
require('dotenv').config();
'use strict';

const express = require('express');
const cors = require('cors');
const path = require('path');
const jwt = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

// -------------------------------
// قراءة متغيرات البيئة الأساسية
// -------------------------------
const APP_VERSION = process.env.APP_VERSION || '1.0.0';
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const SUPERVISOR_CODE = process.env.SUPERVISOR_CODE;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_KEY = process.env.GOOGLE_SERVICE_KEY;
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT || null;

// تحقق أساسي
if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !GOOGLE_SERVICE_KEY) {
  console.error('❌ خطأ: بعض متغيرات البيئة مفقودة (JWT_SECRET, SUPERVISOR_CODE, GOOGLE_SHEET_ID, GOOGLE_SERVICE_KEY).');
  process.exit(1);
}

// -------------------------------
// CORS — إعداد مرن وآمن
// ALLOWED_ORIGINS يمكن أن تكون متغيرة بيئة مفصولة بفواصل
// مثال: ALLOWED_ORIGINS="https://example.com,http://localhost:3000,capacitor://localhost"
// -------------------------------
const DEFAULT_ALLOWED = [
  'https://dwam-app-by-omar.netlify.app',
  'https://dwam-app-by-omar.onrender.com',
  'http://localhost',
  'http://localhost:3000',
  'http://127.0.0.1',
  'https://localhost',
  'capacitor://localhost',
  'ionic://localhost'
];
const envList = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
const allowedOrigins = envList.length ? envList : DEFAULT_ALLOWED;

const corsOptions = {
  origin: function (origin, callback) {
    // origin === undefined => native app (WebView without origin) أو same-origin non-browser (مثل curl)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) return callback(null, true);
    // رفض origin غير مسموح
    return callback(new Error(`CORS blocked: ${origin}`), false);
  },
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// -------------------------------
// تهيئة Firebase Admin (إن وُجد)
let db = null;
if (FIREBASE_SERVICE_ACCOUNT) {
  try {
    const svc = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(svc)
    });
    db = getFirestore();
    console.log('✅ Firebase Admin initialized.');
  } catch (e) {
    console.warn('⚠️ فشل تهيئة Firebase Admin — FIREBASE_SERVICE_ACCOUNT غير صالح؟', e.message);
    db = null;
  }
} else {
  console.log('ℹ️ Firebase Admin not configured (FIREBASE_SERVICE_ACCOUNT empty).');
}

// -------------------------------
// دالة تحويل الأرقام العربية/الفارسية إلى لاتينية
// -------------------------------
function normalizeDigits(str) {
  if (!str && str !== 0) return '';
  str = String(str);
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    return ch;
  });
}

// -------------------------------
// Google Sheets helpers
// -------------------------------
let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch (e) {
  console.error('❌ GOOGLE_SERVICE_KEY ليس JSON صالح.');
  process.exit(1);
}

async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: sheetCreds.client_email,
    private_key: (sheetCreds.private_key || '').replace(/\\n/g, '\n')
  });
  await doc.loadInfo();
  return doc;
}

async function readSheet(title) {
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) throw new Error(`Sheet "${title}" غير موجود`);
  await sheet.loadHeaderRow();
  const rawHeaders = sheet.headerValues || [];
  const cleanHeaders = rawHeaders.map(h => h.trim());
  const rows = await sheet.getRows();
  const data = rows.map(r => cleanHeaders.map(h => r[h] != null ? r[h] : ''));
  return { headers: cleanHeaders, data };
}

// -------------------------------
// Express app
// -------------------------------
const app = express();

app.use(express.json());
app.use(cors(corsOptions));   // استخدم الخيارات الآمنة أعلاه
app.options('*', cors(corsOptions));
app.use(express.static(path.join(__dirname, 'public')));

// -------------------------------
// JWT middleware
// -------------------------------
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

// -------------------------------
// In-memory structures (fallback)
// -------------------------------
const tokens = new Map();                // token -> user
const userNotifications = {};            // code -> [ { title, body, time } ]
const globalNotifications = [];          // unified list

// Helper: send push (uses Firebase Admin if available)
async function sendPushTo(token, title, body, data = {}) {
  if (!db) {
    console.warn('No Firebase Admin configured — skipping FCM send');
    return;
  }
  const message = {
    token,
    notification: { title, body },
    android: { ttl: 48 * 60 * 60 * 1000, priority: 'high' },
    data
  };
  try {
    await admin.messaging().send(message);
    console.log(`✅ pushed to ${token}`);
  } catch (err) {
    console.error(`❌ push failed to ${token}:`, err);
    tokens.delete(token);
    if (err?.errorInfo?.code === 'messaging/registration-token-not-registered' && db) {
      try { await db.collection('fcm_tokens').doc(token).delete(); } catch(e){}
    }
  }
}

// -------------------------------
// Endpoints
// -------------------------------

// Version
app.get('/api/version', (req, res) => res.json({ version: APP_VERSION }));

// Public notifications (no auth) — useful to check reachability before login
app.get('/api/public-notifications', (req, res) => {
  res.json({ notifications: globalNotifications.slice(0, 50) });
});

// Login
app.post('/api/login', cors(corsOptions), async (req, res) => {
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

    const payload = { code, name: row[iN] ?? '' };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });

    return res.json({ token, user: payload });
  } catch (e) {
    console.error('Login error:', e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// Attendance
app.get('/api/attendance', cors(corsOptions), authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    const idx = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(String(req.user.code).trim());

    // user rows
    const userRows = data.filter(r => normalizeDigits(String(r[idx] ?? '').trim()) === target);

    // general note (rows with empty code)
    const generalRows = data.filter(r => !(r[idx] != null && String(r[idx]).trim()));
    const noteCol = headers.indexOf('تنبيهات وملاحظات عامة لجميع العاملين');
    const generalNote = (noteCol !== -1 && generalRows[0] && generalRows[0][noteCol]) ? String(generalRows[0][noteCol]).trim() : '';

    res.json({ headers, data: userRows, generalNote });
  } catch (e) {
    console.error('Attendance error:', e);
    res.status(500).json({ error: e.message || 'Failed to read attendance' });
  }
});

// hwafez
app.get('/api/hwafez', cors(corsOptions), authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r => normalizeDigits(String(r[idx] ?? '').trim()) === target);
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error('hwafez error:', e);
    res.status(500).json({ error: e.message });
  }
});

// tqeem
app.get('/api/tqeem', cors(corsOptions), authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('tqeem');
    const idx = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r => normalizeDigits(String(r[idx] ?? '').trim()) === target);
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error('tqeem error:', e);
    res.status(500).json({ error: e.message });
  }
});

// register-token (store in memory + Firestore if available)
app.post('/api/register-token', cors(corsOptions), authenticate, async (req, res) => {
  const { token } = req.body || {};
  if (!token) return res.status(400).json({ error: 'token required' });
  tokens.set(token, req.user);

  // try persist
  if (db) {
    try {
      await db.collection('fcm_tokens').doc(token).set({
        token,
        user: req.user,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.warn('Failed to persist token to Firestore:', e.message || e);
    }
  }

  res.json({ success: true });
});

// notify-all (supervisor only)
app.post('/api/notify-all', cors(corsOptions), authenticate, async (req, res) => {
  if (String(req.user.code) !== String(SUPERVISOR_CODE)) return res.status(403).json({ error: 'Forbidden' });
  const { title, body } = req.body || {};
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });

  const timeUtc = new Date().toISOString();
  const item = { title, body, time: timeUtc };
  globalNotifications.unshift(item);
  if (globalNotifications.length > 50) globalNotifications.pop();

  // add personal to each user from tokens map
  for (const [t, user] of tokens.entries()) {
    const ucode = user && user.code ? String(user.code) : null;
    if (!ucode) continue;
    userNotifications[ucode] = userNotifications[ucode] || [];
    userNotifications[ucode].unshift(item);
    if (userNotifications[ucode].length > 50) userNotifications[ucode].pop();
  }

  // try send push concurrently (non-blocking failures)
  try {
    const tokenList = Array.from(tokens.keys());
    await Promise.allSettled(tokenList.map(t => sendPushTo(t, title, body)));
  } catch (e) {
    console.warn('notify-all partial error:', e);
  }

  res.json({ success: true });
});

// get notifications for user
app.get('/api/notifications', cors(corsOptions), authenticate, (req, res) => {
  const c = String(req.user.code);
  const personal = userNotifications[c] || [];
  const merged = [...personal, ...globalNotifications]
    .sort((a,b) => new Date(b.time) - new Date(a.time))
    .slice(0,50);
  res.json({ notifications: merged });
});

// clear notifications (supervisor)
app.delete('/api/notifications', cors(corsOptions), authenticate, (req, res) => {
  if (String(req.user.code) !== String(SUPERVISOR_CODE)) return res.status(403).json({ error: 'Forbidden' });
  Object.keys(userNotifications).forEach(k => delete userNotifications[k]);
  globalNotifications.length = 0;
  res.json({ success: true });
});

// SPA fallback (serve index.html for other routes)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} (allowedOrigins: ${allowedOrigins.join(', ')})`));
