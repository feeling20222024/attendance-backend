// server.js

// 1) تحميل متغيّرات البيئة
require('dotenv').config();
const express              = require('express');
const cors                 = require('cors');
const path                 = require('path');
const jwt                  = require('jsonwebtoken');
const { GoogleSpreadsheet} = require('google-spreadsheet');
const admin                = require('firebase-admin');

const APP_VERSION   = process.env.APP_VERSION      || '1.0.7';
const PORT          = process.env.PORT             || 3000;

// 2) دالة لتطبيع الأرقام العربية/الفارسية
function normalizeDigits(str) {
  if (!str) return '';
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    return ch;
  });
}

// 3) تهيئة Firebase Admin
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT غير صالح.');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 4) دالة إرسال إشعار FCM بTTL (48 ساعة بالمللي ثانية)
async function sendPushTo(token, title, body, data = {}) {
  const message = {
    token,
    notification: { title, body },
    android: {
      ttl: 48 * 60 * 60 * 1000, // 48h in ms
      priority: 'high'
    },
    data
  };
  try {
    await admin.messaging().send(message);
  } catch (err) {
    console.error(`❌ فشل الإرسال إلى ${token}:`, err);
  }
}

// 5) تهيئة Express مع CORS
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 6) المتغيرات الأساسية
const {
  JWT_SECRET,
  SUPERVISOR_CODE,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_KEY
} = process.env;
if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !GOOGLE_SERVICE_KEY) {
  console.error('❌ بدون بعض متغيّرات البيئة.');
  process.exit(1);
}
let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch {
  console.error('❌ GOOGLE_SERVICE_KEY ليس JSON صالح.');
  process.exit(1);
}

// 7) دوال Google Sheets
async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: sheetCreds.client_email,
    private_key:  sheetCreds.private_key.replace(/\\n/g,'\n')
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
  const data    = rows.map(r => headers.map(h => r[h]||''));
  return { headers, data };
}

// 8) JWT Middleware
function authenticate(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error:'Unauthorized' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error:'Invalid token' });
  }
}

// 9) تسجيل الدخول
app.post('/api/login', async (req, res) => {
  let { code, pass } = req.body;
  if (!code||!pass) return res.status(400).json({ error:'code and pass required' });
  code = normalizeDigits(code.trim());
  pass = normalizeDigits(pass.trim());
  try {
    const { headers, data } = await readSheet('Users');
    const iC = headers.indexOf('كود الموظف');
    const iP = headers.indexOf('كلمة المرور');
    const iN = headers.indexOf('الاسم');
    const row = data.find(r =>
      normalizeDigits((r[iC]||'').trim())===code &&
      normalizeDigits((r[iP]||'').trim())===pass
    );
    if (!row) return res.status(401).json({ error:'Invalid credentials' });
    const payload = { code, name: row[iN] };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn:'12h' });
    res.json({ token, user: payload });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:'Login failed' });
  }
});

// 10) /api/attendance — حضور + ملاحظات خاصة وعامة
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    const idx     = headers.indexOf('رقم الموظف');
    const code    = normalizeDigits(String(req.user.code).trim());
    const userRows = data.filter(r => normalizeDigits((r[idx]||'').trim())===code);
    // ملاحظة خاصة
    const colSpec = headers.indexOf('تنبيهات وملاحظات عامة');
    const noteSpec = userRows.find(r=>r[colSpec]?.trim())?.[colSpec]?.trim()||'';
    // ملاحظة لجميع العاملين
    const generalRows = data.filter(r=>!(r[idx]||'').toString().trim());
    const colAll = headers.indexOf('تنبيهات وملاحظات عامة لجميع العاملين');
    const noteAll = generalRows[0]?.[colAll]?.trim()||'';
    res.json({ headers, data: userRows, noteSpec, noteAll });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:e.message });
  }
});

// 11) الحوافز
app.get('/api/hwafez', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx  = headers.indexOf('رقم الموظف');
    const code = normalizeDigits(String(req.user.code).trim());
    res.json({ headers, data: data.filter(r=>normalizeDigits((r[idx]||'').trim())===code) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:e.message });
  }
});

// 12) التقييم السنوي
app.get('/api/tqeem', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('tqeem');
    const idx  = headers.indexOf('رقم الموظف');
    const code = normalizeDigits(String(req.user.code).trim());
    res.json({ headers, data: data.filter(r=>normalizeDigits((r[idx]||'').trim())===code) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:e.message });
  }
});

// 13) تسجيل توكن FCM
const tokens = new Map();
app.post('/api/register-token', authenticate, (req, res) => {
  const { user, token } = req.body;
  if (!user||!token) return res.status(400).json({ error:'user and token required' });
  tokens.set(token, user);
  res.json({ success:true });
});

// 14) إشعار للجميع (مشرف فقط)
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code!==SUPERVISOR_CODE) return res.status(403).json({ error:'Forbidden' });
  const { title, body } = req.body;
  await Promise.allSettled(Array.from(tokens.keys()).map(t=>sendPushTo(t,title,body)));
  res.json({ success:true });
});

// 15) سجل الإشعارات الموحد في الذاكرة
const userNotifications = {};
app.post('/api/notifications', authenticate, (req, res) => {
  const { title, body, time } = req.body;
  if (!title||!body||!time) return res.status(400).json({ error:'Missing fields' });
  const code = req.user.code;
  userNotifications[code] = userNotifications[code]||[];
  userNotifications[code].unshift({ title, body, time });
  if (userNotifications[code].length>50) userNotifications[code].pop();
  res.json({ success:true });
});
app.get('/api/notifications', authenticate, (req, res) => {
  res.json({ notifications: userNotifications[req.user.code]||[] });
});
// **مسح سِجل الإشعارات للمشرف فقط**
app.delete('/api/notifications', authenticate, (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) {
    return res.status(403).json({ error: 'Forbidden: only supervisor can clear all notifications' });
  }
  for (const code of Object.keys(userNotifications)) {
    delete userNotifications[code];
  }
  res.json({ success: true, message: 'All notifications cleared by supervisor' });
});
// 16) نسخة التطبيق
app.get('/api/version', (_, res) => {
  res.json({ version: APP_VERSION });
});

// 17) SPA fallback
app.get(/.*/, (_, res) =>
  res.sendFile(path.join(__dirname,'public','index.html'))
);

// 18) بدء الخادم
app.listen(PORT, ()=>console.log(`🚀 الخادم يعمل على ${PORT}`));
