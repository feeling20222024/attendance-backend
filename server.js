// server.js

// 1) تحميل متغيّرات البيئة من .env
require('dotenv').config();

const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const path    = require('path');

const PORT     = process.env.PORT || 3000;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// التحقق من وجود المتغيرات البيئية المطلوبة
if (!SHEET_ID) {
  console.error('🚨 GOOGLE_SHEET_ID غير موجود في .env');
  process.exit(1);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
  console.error('🚨 GOOGLE_APPLICATION_CREDENTIALS_JSON غير موجود في .env');
  process.exit(1);
}

// تهيئة بيانات الاعتماد من المتغيرات البيئية
const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);

// 2) تهيئة Express
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 3) دوال الوصول إلى Google Sheet
async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth(creds);
  await doc.loadInfo();
  return doc;
}

async function readSheet(title) {
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) throw new Error(`الشيت "${title}" غير موجود`);
  await sheet.loadHeaderRow();
  const headers = sheet.headerValues;
  const rows    = await sheet.getRows();
  const data    = rows.map(r => headers.map(h => r[h] ?? ''));
  return { headers, data };
}

// 4) API بلا مصادقة
app.get('/api/users', async (req, res) => {
  try {
    const result = await readSheet('Users');
    res.json(result);
  } catch (err) {
    console.error('خطأ في جلب بيانات المستخدمين:', err);
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    const result = await readSheet('Attendance');
    res.json(result);
  } catch (err) {
    console.error('خطأ في جلب بيانات الحضور:', err);
    res.status(400).json({ error: err.message });
  }
});

// 5) توجيه باقي الطلبات للواجهة
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 6) تشغيل الخادم
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  // اختبار الاتصال عند بدء التشغيل
  accessSheet().then(() => {
    console.log('✅ تم الاتصال بنجاح مع Google Sheets');
  }).catch(err => {
    console.error('🚨 خطأ في الاتصال مع Google Sheets:', err);
  });
});