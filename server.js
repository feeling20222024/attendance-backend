'use strict';

// 1) تحميل متغيّرات البيئة
require('dotenv').config();
const express               = require('express');
const cors                  = require('cors');
const path                  = require('path');
const jwt                   = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin                 = require('firebase-admin');

// 2) إعداد المتغيّرات الأساسية
const API_VERSION     = process.env.APP_VERSION        || '1.0.0';
const JWT_SECRET      = process.env.JWT_SECRET;
const SUPERVISOR_CODE = process.env.SUPERVISOR_CODE;
const SHEET_ID        = process.env.GOOGLE_SHEET_ID;
const sheetCredsRaw   = process.env.GOOGLE_SERVICE_KEY;
const FIREBASE_SA     = process.env.FIREBASE_SERVICE_ACCOUNT;

if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !sheetCredsRaw || !FIREBASE_SA) {
  console.error('❌ بعض متغيرات البيئة مفقودة.');
  process.exit(1);
}

// 3) دالة لتحويل الأرقام العربية/الفارسية إلى لاتينية
function normalizeDigits(str) {
  if (!str) return '';
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    return ch;
  });
}

// 4) تهيئة Firebase Admin
let serviceAccount;
try {
  serviceAccount = JSON.parse(FIREBASE_SA);
} catch {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT غير صالح.');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// 5) دالة لإرسال إشعار FCM
async function sendPushTo(token, title, body, data = {}) {
  const message = {
    token,
    notification: { title, body },
    android: {
      ttl: '172800s',
      priority: 'high',
      notification: { android_channel_id: 'default', sound: 'default', vibrate_timings: [100,200,100] }
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

// 6) إعداد Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 7) تهيئة ومستند Google Sheets
let sheetsCreds;
try {
  sheetsCreds = JSON.parse(sheetCredsRaw);
} catch {
  console.error('❌ GOOGLE_SERVICE_KEY ليس JSON صالح.');
  process.exit(1);
}

async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: sheetsCreds.client_email,
    private_key:  sheetsCreds.private_key.replace(/\\n/g,"\n")
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
  if (!code || !pass) return res.status(400).json({ error:'code and pass required' });
  code = normalizeDigits(code.trim());
  pass = normalizeDigits(pass.trim());
  try {
    const { headers, data } = await readSheet('Users');
    const iC = headers.indexOf('كود الموظف');
    const iP = headers.indexOf('كلمة المرور');
    const iN = headers.indexOf('الاسم');
    const row = data.find(r =>
      normalizeDigits(r[iC]) === code &&
      normalizeDigits(r[iP]) === pass
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

// 10) جلب ملاحظة المشرف من A2
app.get('/api/supervisor-note', authenticate, async (req, res) => {
  try {
    const { data } = await readSheet('Attendance');
    // data[1][0] → الخلية A2
    const note = (data[1] && data[1][0]) || '';
    res.json({ note });
  } catch (err) {
    console.error('خطأ في تحميل ملاحظة المراقب:', err);
    res.status(500).json({ error:'خطأ في الخادم' });
  }
});

// 11) مسار استعلام بيانات المستخدم نفسه
app.get('/api/me', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Users');
    const idxCode = headers.indexOf('كود الموظف');
    const target  = normalizeDigits(req.user.code);
    const row     = data.find(r => normalizeDigits(r[idxCode]) === target);
    if (!row) return res.status(404).json({ error:'User not found' });
    const single = {};
    headers.forEach((h,i) => single[h] = row[i] ?? '');
    res.json({ user: single });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:e.message });
  }
});

// 12) حضور
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    const idx    = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(req.user.code);
    const filtered = data.filter(r => normalizeDigits(r[idx]) === target);
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:e.message });
  }
});

// 13) حوافز
app.get('/api/hwafez', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx    = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(req.user.code);
    const filtered = data.filter(r => normalizeDigits(r[idx]) === target);
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:e.message });
  }
});

// 14) تقييم سنوي
app.get('/api/tqeem', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('tqeem');
    const idx    = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(req.user.code);
    const filtered = data.filter(r => normalizeDigits(r[idx]) === target);
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:e.message });
  }
});

// 15) تسجيل توكن FCM
const tokens = new Map();
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) return res.status(400).json({ error:'user and token required' });
  tokens.set(token, user);
  res.json({ success:true });
});

// 16) إشعار لجميع الأجهزة
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) return res.status(403).json({ error:'Forbidden' });
  const { title, body } = req.body;
  await Promise.allSettled(
    Array.from(tokens.keys()).map(t => sendPushTo(t, title, body))
  );
  res.json({ success:true });
});

// 17) سجل الإشعارات المؤقت
const userNotifications = {};
app.post('/api/notifications', authenticate, (req, res) => {
  const { title, body, time } = req.body;
  if (!title || !body || !time) return res.status(400).json({ error:'Missing fields' });
  const code = req.user.code;
  userNotifications[code] = userNotifications[code] || [];
  userNotifications[code].unshift({ title, body, time });
  if (userNotifications[code].length > 50) userNotifications[code].pop();
  res.json({ success:true });
});
app.get('/api/notifications', authenticate, (req, res) => {
  res.json({ notifications: userNotifications[req.user.code] || [] });
});

// 18) إصدار الخادم
app.get('/api/version', (_, res) => res.json({ version:API_VERSION }));

// 19) SPA fallback
app.get('*', (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// 20) بدء الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 الخادم يعمل على ${PORT}`));
