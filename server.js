// 1) تحميل متغيّرات البيئة من .env
require('dotenv').config();

const admin = require('firebase-admin');
const serviceAccount = require('./path/to/firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const express = require('express');
const cors = require('cors');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const path = require('path');

// مصفوفة مؤقتة لتخزين التوكنات؛ بالإمكان تعويضها بقاعدة بيانات
const tokens = new Map();

// استقبال التوكن وتخزينه
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) {
    return res.status(400).json({ error: 'مفقود user أو token' });
  }
  // يمكنك هنا ربط التوكن بمعرّف المستخدم في قاعدة بياناتك
  tokens.set(token, user);
  console.log(`🔔 سجّل التوكن للمستخدم ${user}:`, token);
  res.json({ success: true });
});

const PORT     = process.env.PORT || 3000;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

// التحقق من وجود المتغيرات البيئية المطلوبة
if (!SHEET_ID) {
  console.error('🚨 GOOGLE_SHEET_ID غير موجود في .env');
  process.exit(1);
}
if (!process.env.GOOGLE_SERVICE_KEY) {
  console.error('🚨 GOOGLE_SERVICE_KEY غير موجود في .env');
  process.exit(1);
}

// 2) تهيئة بيانات الاعتماد من المتغير البيئي
let creds;
try {
  creds = JSON.parse(process.env.GOOGLE_SERVICE_KEY);
} catch (e) {
  console.error('🚨 فشل في قراءة GOOGLE_SERVICE_KEY. تأكد من تنسيق JSON صحيح في .env');
  process.exit(1);
}

// 3) تهيئة Express
const app = express();

// تفعيل CORS قبل أي راوتر
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 4) دوال الوصول إلى Google Sheet
async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: creds.client_email,
    private_key: creds.private_key.replace(/\\n/g, '\n'),
  });
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

// 5) API: جلب بيانات Users
app.get('/api/users', async (req, res) => {
  try {
    const result = await readSheet('Users');
    res.json(result);
  } catch (err) {
    console.error('خطأ في جلب بيانات المستخدمين:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// 6) API: جلب بيانات Attendance
app.get('/api/attendance', async (req, res) => {
  try {
    const result = await readSheet('Attendance');
    res.json(result);
  } catch (err) {
    console.error('خطأ في جلب بيانات الحضور:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// 7) API: جلب بيانات hwafez
app.get('/api/hwafez', async (req, res) => {
  try {
    const result = await readSheet('hwafez');
    res.json(result);
  } catch (err) {
    console.error('خطأ في جلب بيانات hwafez:', err.message);
    res.status(400).json({ error: err.message });
  }
});
// 8) API: إرسال إشعار للمستخدمين
app.post('/api/notify-all', async (req, res) => {
  const { title, body } = req.body;
  console.log('🔔 إشعار مرسل:', title, body);
  // مبدئيًا: طباعة فقط – يمكن ربطه لاحقًا بـ Firebase أو خدمة إشعارات
  res.json({ success: true, message: 'هام يوجد تحديث للبيانات' });
});
// 8) SPA fallback لأي طلب GET آخر
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 9) تشغيل الخادم
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  // اختبار الاتصال عند بدء التشغيل
  accessSheet()
    .then(() => console.log('✅ تم الاتصال بنجاح مع Google Sheets'))
    .catch(err => console.error('🚨 خطأ في الاتصال مع Google Sheets:', err.message));
});
