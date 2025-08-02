// server.js

// 1) تحميل متغيّرات البيئة
require('dotenv').config();
const APP_VERSION          = process.env.APP_VERSION      || '1.0.7';
const express              = require('express');
const cors                 = require('cors');
const path                 = require('path');
const jwt                  = require('jsonwebtoken');
const { GoogleSpreadsheet} = require('google-spreadsheet');
const admin                = require('firebase-admin');

// 2) دالة لتحويل الأرقام العربية/الفارسية إلى لاتينية
function normalizeDigits(str) {
  if (!str) return '';
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    return ch;
  });
}

// 3) تهيئة Firebase Admin من متغيّر البيئة
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch {
  console.error('❌ خطأ: FIREBASE_SERVICE_ACCOUNT غير صالح.');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 4) دالة لإرسال إشعار FCM (48 ساعة TTL بالمللي ثانية)
async function sendPushTo(token, title, body, data = {}) {
  const message = {
    token,
    notification: { title, body },
    android: {
      ttl: 48 * 60 * 60 * 1000,  // 48h in ms
      priority: 'high'
    },
    data
  };
  try {
    const resp = await admin.messaging().send(message);
    console.log(`✅ تم الإرسال إلى ${token}: ${resp}`);
  } catch (err) {
    console.error(`❌ فشل الإرسال إلى ${token}:`, err);
  }
}

// 5) تهيئة Express مع CORS
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 6) قراءة متغيّرات البيئة الأساسية لـ Google Sheets وJWT
const {
  JWT_SECRET,
  SUPERVISOR_CODE,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_KEY
} = process.env;
if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !GOOGLE_SERVICE_KEY) {
  console.error('❌ بعض متغيرات البيئة مفقودة.');
  process.exit(1);
}
let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch {
  console.error('❌ GOOGLE_SERVICE_KEY ليس JSON صالح.');
  process.exit(1);
}

// 7) دوال الوصول إلى Google Sheets
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
  const data    = rows.map(r => headers.map(h => r[h] ?? ''));
  return { headers, data };
}

// 8) Middleware للتحقّق من JWT
function authenticate(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// 9) تسجيل الدخول
app.post('/api/login', async (req, res) => {
  let { code, pass } = req.body;
  if (!code || !pass) return res.status(400).json({ error: 'code and pass required' });

  code = normalizeDigits(String(code).trim());
  pass = normalizeDigits(String(pass).trim());

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

// 10) حضور + تنبيه عام + تنبيه لجميع العاملين
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    const idx    = headers.indexOf('رقم الموظف');
    const code   = normalizeDigits(String(req.user.code).trim());

    // صفوف المستخدم
    const userRows    = data.filter(r => normalizeDigits((r[idx]||'').trim()) === code);
    // تنبيه خاص في العمود "تنبيهات وملاحظات عامة"
    const noteCol2    = headers.indexOf('تنبيهات وملاحظات عامة');
    const generalNote = userRows.find(r => r[noteCol2]?.trim())?.[noteCol2]?.trim() || '';

    // تنبيه لجميع العاملين في العمود "تنبيهات وملاحظات عامة لجميع العاملين"
    const generalRows = data.filter(r => !(r[idx]||'').toString().trim());
    const noteColAll  = headers.indexOf('تنبيهات وملاحظات عامة لجميع العاملين');
    const generalNoteAll = generalRows[0]?.[noteColAll]?.trim() || '';

    res.json({ headers, data: userRows, generalNote, generalNoteAll });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 11) الحوافز
app.get('/api/hwafez', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx    = headers.indexOf('رقم الموظف');
    const code   = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r => normalizeDigits((r[idx]||'').trim()) === code);
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 12) التقييم السنوي
app.get('/api/tqeem', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('tqeem');
    const idx    = headers.indexOf('رقم الموظف');
    const code   = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r => normalizeDigits((r[idx]||'').trim()) === code);
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 13) تسجيل توكن FCM
const tokens = new Map();
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) return res.status(400).json({ error: 'user and token required' });
  tokens.set(token, user);
  res.json({ success: true });
});

// 14) إشعار لجميع الأجهزة (للمشرف فقط)
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) return res.status(403).json({ error: 'Forbidden' });
  const { title, body } = req.body;
  await Promise.allSettled(Array.from(tokens.keys()).map(t => sendPushTo(t, title, body)));
  res.json({ success: true });
});

// 15) سجل الإشعارات الموحد (ذاكرة مؤقتة)
const userNotifications = {};
app.post('/api/notifications', authenticate, (req, res) => {
  const { title, body, time } = req.body;
  if (!title || !body || !time) return res.status(400).json({ error: 'Missing fields' });
  const code = req.user.code;
  userNotifications[code] = userNotifications[code] || [];
  userNotifications[code].unshift({ title, body, time });
  if (userNotifications[code].length > 50) userNotifications[code].pop();
  res.json({ success: true });
});
app.get('/api/notifications', authenticate, (req, res) => {
  res.json({ notifications: userNotifications[req.user.code] || [] });
});

// 16) إصدار التطبيق
app.get('/api/version', (req, res) => {
  res.json({ version: APP_VERSION });
});

// 17) SPA fallback
app.get(/.*/, (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// 18) بدء الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 الخادم يعمل على ${PORT}`));
