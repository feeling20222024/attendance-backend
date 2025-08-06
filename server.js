// server.js

// 1) تحميل متغيّرات البيئة
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


const app = express();

const corsOptions = {
  origin: 'https://dwam-app-by-omar.netlify.app',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

// دعم طلبات preflight لجميع المسارات أولاً
app.options('*', cors(corsOptions));

// ثم استخدم الـ middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 4) حذف التوكن غير الصالح من Firestore
async function deleteTokenFromFirestore(token) {
  const snapshot = await db.collection('fcm_tokens')
    .where('token', '==', token)
    .get();
  snapshot.forEach(doc => doc.ref.delete());
}

// 5) دالة إرسال إشعار FCM مع تنظيف التوكنات
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
    if (err.errorInfo?.code === 'messaging/registration-token-not-registered') {
      console.warn(`🗑️ حذف التوكن غير الصالح: ${token}`);
      await deleteTokenFromFirestore(token);
    }
  }
}

// 6) إعدادات عامة
const APP_VERSION       = process.env.APP_VERSION        || '1.0.0';
const PORT              = process.env.PORT               || 3000;
const JWT_SECRET        = process.env.JWT_SECRET;
const SUPERVISOR_CODE   = process.env.SUPERVISOR_CODE;
const SHEET_ID          = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_KEY= process.env.GOOGLE_SERVICE_KEY;

if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !GOOGLE_SERVICE_KEY) {
  console.error('❌ بعض متغيرات البيئة مفقودة.');
  process.exit(1);
}

// 7) تطبيع الأرقام عربية→غربية
function normalizeDigits(str) {
  if (!str) return '';
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    return String(code & 0xF);
  });
}

// 8) إعداد Google Sheets
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
  const headers = sheet.headerValues;
  const rows    = await sheet.getRows();
  const headers = rawHeaders.map(h => h.trim());
  const data    = rows.map(r => headers.map(h => r[h] || ''));
  return { headers, data };
}

// 9) JWT Middleware
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

// 10) تسجيل الدخول
app.post('/api/login', async (req, res) => {
  let { code, pass } = req.body;
  if (!code || !pass) return res.status(400).json({ error: 'code and pass required' });
  code = normalizeDigits(code.trim());
  pass = normalizeDigits(pass.trim());
  try {
    const { headers, data } = await readSheet('Users');
    const iC = headers.indexOf('كود الموظف');
    const iP = headers.indexOf('كلمة المرور');
    const iN = headers.indexOf('الاسم');
    const row = data.find(r =>
      normalizeDigits((r[iC]||'').trim()) === code &&
      normalizeDigits((r[iP]||'').trim()) === pass
    );
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    const payload = { code, name: row[iN] };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: payload });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 11) حضور + ملاحظات
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    const idx  = headers.indexOf('رقم الموظف');
    const code = normalizeDigits(String(req.user.code).trim());
    const userRows = data.filter(r =>
      normalizeDigits((r[idx]||'').trim()) === code
    );

  const colPersonal  = headers.indexOf('تنبيهات وملاحظات خاصة بالعامل');
  const colGeneral   = headers.indexOf('تنبيهات وملاحظات عامة لجميع العاملين');

    const code = normalizeDigits(String(req.user.code).trim());

    // صفوف الموظف
    const userRows = data.filter(r =>
      normalizeDigits((r[idx] || '').trim()) === code
    );

    // أول صف للمشرف يحتوي فعلاً على ملاحظة خاصة
    const personalRow = userRows.find(r =>
      (r[colPersonal] || '').toString().trim() !== ''
    );
    const personalNote = personalRow
      ? personalRow[colPersonal].toString().trim()
      : '';

    // استخراج أول صف عام (رقم الموظف فارغ) للملاحظة العامة
    const generalRow = data.find(r =>
      !(r[idx] || '').toString().trim()
    );
    const generalNote = generalRow
      ? (generalRow[colGeneral] || '').toString().trim()
      : '';

    res.json({
      headers,
      data: userRows,
      personalNote,
      generalNote
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 12) الحوافز
app.get('/api/hwafez', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx  = headers.indexOf('رقم الموظف');
    const code = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r =>
      normalizeDigits((r[idx]||'').trim()) === code
    );
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 13) التقييم السنوي
app.get('/api/tqeem', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('tqeem');
    const idx  = headers.indexOf('رقم الموظف');
    const code = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r =>
      normalizeDigits((r[idx]||'').trim()) === code
    );
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 14) تسجيل توكن FCM
const tokens = new Map();
app.post('/api/register-token', authenticate, (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  tokens.set(token, req.user);
  res.json({ success: true });
});

// 15) إشعار للجميع + تخزين
const userNotifications = {};
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });
  await Promise.allSettled(
    Array.from(tokens.keys()).map(t => sendPushTo(t, title, body))
  );
  for (const user of tokens.values()) {
    const c = user.code;
    userNotifications[c] = userNotifications[c] || [];
    userNotifications[c].unshift({ title, body, time: new Date().toISOString() });
    if (userNotifications[c].length > 50) userNotifications[c].pop();
  }
  res.json({ success: true });
});

// 16) سجل الإشعارات الموحد
app.get('/api/notifications', cors(corsOptions), authenticate, (req, res) => {
  const c = req.user.code;
  res.json({ notifications: userNotifications[c] || [] });
});
app.delete('/api/notifications', cors(corsOptions), authenticate, (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) return res.status(403).json({ error: 'Forbidden' });
  Object.keys(userNotifications).forEach(k => delete userNotifications[k]);
  res.json({ success: true });
});

// 17) إصدار التطبيق
app.get('/api/version', (_, res) => res.json({ version: APP_VERSION }));

// 18) SPA fallback
app.get(/.*/, (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// 19) بدء الخادم
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
