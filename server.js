// 1) تحميل متغيّرات البيئة من .env
require('dotenv').config();
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin = require('firebase-admin');

// 2) تهيئة Firebase Admin
const serviceAccount = require('./firebase-service-account.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 3) تهيئة Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 4) مصفوفة مؤقتة لتخزين التوكنات (يمكن استبدالها بقاعدة بيانات)
const tokens = new Map();

// 5) مسار تسجيل التوكن من العميل
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) {
    return res.status(400).json({ error: 'مفقود user أو token' });
  }
  tokens.set(token, user);
  console.log(`🔔 سجّل التوكن للمستخدم ${user}:`, token);
  res.json({ success: true });
});

// 6) إعداد Google Sheets
const PORT     = process.env.PORT || 3000;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
if (!SHEET_ID || !process.env.GOOGLE_SERVICE_KEY) {
  console.error('🚨 missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_KEY');
  process.exit(1);
}
let creds;
try {
  creds = JSON.parse(process.env.GOOGLE_SERVICE_KEY);
} catch {
  console.error('🚨 invalid GOOGLE_SERVICE_KEY JSON');
  process.exit(1);
}

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
  if (!sheet) throw new Error(`Sheet "${title}" not found`);
  await sheet.loadHeaderRow();
  const headers = sheet.headerValues;
  const rows    = await sheet.getRows();
  const data    = rows.map(r => headers.map(h => r[h] ?? ''));
  return { headers, data };
}

// 7) مسارات API للقراءة
app.get('/api/users',    async (req, res) => { try { res.json(await readSheet('Users')); }    catch (e) { res.status(400).json({ error: e.message }); } });
app.get('/api/attendance',async (req, res) => { try { res.json(await readSheet('Attendance')); }catch (e) { res.status(400).json({ error: e.message }); } });
app.get('/api/hwafez',   async (req, res) => { try { res.json(await readSheet('hwafez')); }   catch (e) { res.status(400).json({ error: e.message }); } });

// 8) مسار إرسال الإشعار للمشرف (فقط عبر FCM)
app.post('/api/notify-all', async (req, res) => {
  const { title, body } = req.body;
  const message = {
    notification: { title, body },
    tokens:       Array.from(tokens.keys())
  };
  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log('FCM multicast result:', response);
    res.json({ success: true, sent: response.successCount });
  } catch (err) {
    console.error('FCM error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 9) SPA fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 10) تشغيل الخادم
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  accessSheet()
    .then(() => console.log('✅ Connected to Google Sheets'))
    .catch(err => console.error('🚨 Sheet access error:', err.message));
});
