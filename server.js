// server.js

// 1) تحميل متغيّرات البيئة من .env
require('dotenv').config();

const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');
const path    = require('path');
const fs      = require('fs');

// 2) إعداد المتغيّرات من .env
const PORT             = process.env.PORT           || 3000;
const JWT_SECRET       = process.env.JWT_SECRET;
const ADMIN_CODE       = process.env.ADMIN_CODE     || 'admin';
const ADMIN_PASS       = process.env.ADMIN_PASS     || 'password';
const SHEET_ID         = process.env.GOOGLE_SHEET_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_APPLICATION_CREDENTIALS;

if (!JWT_SECRET) {
  console.error('🚨 JWT_SECRET غير موجود في .env');
  process.exit(1);
}
if (!SHEET_ID) {
  console.error('🚨 GOOGLE_SHEET_ID غير موجود في .env');
  process.exit(1);
}
if (!CREDENTIALS_PATH || !fs.existsSync(path.resolve(CREDENTIALS_PATH))) {
  console.error('🚨 ملف مفاتيح الخدمة غير موجود أو مساره خاطئ في GOOGLE_APPLICATION_CREDENTIALS');
  process.exit(1);
}

// 3) تحميل مفاتيح Service Account
const creds = require(path.resolve(CREDENTIALS_PATH));

// 4) تهيئة Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 5) دالة للوصول إلى Google Sheet
async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  return doc;
}

// 6) دالة قراءة شيت حسب عنوانه
async function readSheet(title) {
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) {
    throw new Error(`الشيت "${title}" غير موجود`);
  }
  await sheet.loadHeaderRow();
  const headers = sheet.headerValues;
  const rows    = await sheet.getRows();
  const data    = rows.map(r => headers.map(h => r[h] || ''));
  return { headers, data };
}

// 7) Middleware للتحقق من JWT
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error();
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// 8) API: تسجيل دخول المشرف
app.post('/api/admin/login', (req, res) => {
  const { code, password } = req.body;
  if (code === ADMIN_CODE && password === ADMIN_PASS) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'بيانات المسؤول غير صحيحة' });
});

// 9) API: جلب بيانات Users من Google Sheet
app.get('/api/users', auth, async (req, res) => {
  try {
    const result = await readSheet('Users');
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 10) API: جلب بيانات Attendance من Google Sheet
app.get('/api/attendance', auth, async (req, res) => {
  try {
    const result = await readSheet('Attendance');
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// 11) أي طلب GET آخر → صفحة الواجهة (SPA fallback)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 12) تشغيل الخادم
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
