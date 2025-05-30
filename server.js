// 1) تحميل متغيّرات البيئة من .env
require('dotenv').config();
const express          = require('express');
const cors             = require('cors');
const path             = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin            = require('firebase-admin');

// 2) بيانات حساب الخدمة (يمكن تحميلها من process.env كما سبق)
const serviceAccount = {
  type:                        "service_account",
  project_id:                  process.env.GOOGLE_PROJECT_ID,
  private_key_id:              process.env.GOOGLE_PRIVATE_KEY_ID,
  private_key:                 process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  client_email:                process.env.GOOGLE_CLIENT_EMAIL,
  client_id:                   process.env.GOOGLE_CLIENT_ID,
  auth_uri:                    process.env.GOOGLE_AUTH_URI,
  token_uri:                   process.env.GOOGLE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.GOOGLE_AUTH_PROVIDER_CERT_URL,
  client_x509_cert_url:        process.env.GOOGLE_CLIENT_CERT_URL,
  universe_domain:             process.env.GOOGLE_UNIVERSE_DOMAIN
};

// 3) تهيئة Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 4) تهيئة Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 5) تخزين توكنات مؤقت (ابدأ بقاعدة بيانات لاحقًا)
const tokens = new Map();

// 6) مسار تسجيل توكن من الواجهة
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) {
    return res.status(400).json({ error: 'مفقود user أو token' });
  }
  tokens.set(token, user);
  console.log(`🔔 سجّل التوكن للمستخدم ${user}:`, token);
  res.json({ success: true });
});

// 7) إعداد Google Sheets
const PORT     = process.env.PORT || 3000;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: serviceAccount.client_email,
    private_key:  serviceAccount.private_key,
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

// 8) مسارات API للقراءة
app.get('/api/users',     async (req, res) => {
  try { res.json(await readSheet('Users')); }
  catch(e){ res.status(400).json({ error: e.message }); }
});
app.get('/api/attendance', async (req, res) => {
  try { res.json(await readSheet('Attendance')); }
  catch(e){ res.status(400).json({ error: e.message }); }
});
app.get('/api/hwafez',    async (req, res) => {
  try { res.json(await readSheet('hwafez')); }
  catch(e){ res.status(400).json({ error: e.message }); }
});

// 9) مسار إرسال إشعار (فقط للمشرف)
app.post('/api/notify-all', async (req, res) => {
  const { title, body } = req.body;
  const tokensList = Array.from(tokens.keys());
  console.log('🔔 notify-all called, tokens:', tokensList);

  const payload = { notification: { title, body } };

  try {
    const response = await admin.messaging().sendToDevice(tokensList, payload);
    console.log('FCM sendToDevice result:', response);
    const successCount = response.results.filter(r => !r.error).length;
    res.json({ success: true, sent: successCount });
  } catch (err) {
    console.error('FCM error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 10) SPA fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 11) تشغيل الخادم
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
