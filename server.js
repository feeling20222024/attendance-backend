// server.js
require('dotenv').config();
const express          = require('express');
const cors             = require('cors');
const path             = require('path');
const jwt              = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin            = require('firebase-admin');

// === 1) إعداد Firebase Admin ===
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// === 2) إعداد Express ===
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === 3) Middleware للتحقّق من JWT ===
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = auth.slice(7);
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// === 4) مسار تسجيل الدخول وإصدار JWT ===
app.post('/api/login', async (req, res) => {
  const { code, pass } = req.body;
  if (!code || !pass) {
    return res.status(400).json({ error: 'code and pass required' });
  }
  try {
    // نقرأ شيت Users
    const { headers, data } = await readSheet('Users');
    const iCode = headers.indexOf('كود الموظف');
    const iPass = headers.indexOf('كلمة المرور');
    const iName = headers.indexOf('الاسم');

    // نبحث الصفّ المطابق
    const row = data.find(r =>
      String(r[iCode]).trim() === code &&
      String(r[iPass]).trim() === pass
    );
    if (!row) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // نصدر JWT يحوي الكود والاسم
    const payload = { code, name: row[iName] };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ token, user: payload });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// === 5) تخزين توكنات FCM مؤقتاً ===
const tokens = new Map();
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) {
    return res.status(400).json({ error: 'user and token required' });
  }
  tokens.set(token, user);
  console.log(`🔔 registered token for ${user}:`, token);
  res.json({ success: true });
});

// === 6) إعداد Google Sheets ===
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
if (!SHEET_ID) {
  console.error('🚨 missing GOOGLE_SHEET_ID in .env');
  process.exit(1);
}
const sheetCreds = JSON.parse(process.env.GOOGLE_SERVICE_KEY);

async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: sheetCreds.client_email,
    private_key:  sheetCreds.private_key.replace(/\\n/g, '\n'),
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

// === 7) مسارات API المحمية ===
app.get('/api/users',     authenticate, async (req, res) => {
  try { res.json(await readSheet('Users')); }
  catch(e){ console.error(e); res.status(500).json({ error: e.message }); }
});
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    // نعيد فقط صفوف الموظّف الحالي:
    const { headers, data } = await readSheet('Attendance');
    const codeIdx = headers.indexOf('رقم الموظف');
    const filtered = data.filter(r => String(r[codeIdx]).trim() === req.user.code);
    res.json({ headers, data: filtered });
  } catch(e){
    console.error(e); res.status(500).json({ error: e.message });
  }
});
app.get('/api/hwafez',    authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const codeIdx = headers.indexOf('رقم الموظف');
    const filtered = data.filter(r => String(r[codeIdx]).trim() === req.user.code);
    res.json({ headers, data: filtered });
  } catch(e){
    console.error(e); res.status(500).json({ error: e.message });
  }
});

// === 8) مسار إرسال إشعار مشفّر (فقط بعد تسجيل دخول المشرف) ===
app.post('/api/notify-all', authenticate, async (req, res) => {
  // نتأكد أن هذا المستخدم هو المشرف
  if (req.user.code !== process.env.SUPERVISOR_CODE) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { title, body } = req.body;
  const list = Array.from(tokens.keys());
  console.log('🔔 notify-all called by', req.user.code, 'tokens:', list);
  try {
    const response = await admin.messaging().sendToDevice(list, {
      notification: { title, body }
    });
    const sent = response.results.filter(r => !r.error).length;
    res.json({ success: true, sent });
  } catch(err) {
    console.error('FCM error:', err);
    res.status(500).json({ error: err.message });
  }
});

// === 9) SPA fallback & بدء التشغيل ===
app.get(/.*/, (_,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, ()=> console.log(`✅ Server listening on port ${PORT}`));
