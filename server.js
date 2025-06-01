// server.js
require('dotenv').config();
const express               = require('express');
const cors                  = require('cors');
const path                  = require('path');
const jwt                   = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin                 = require('firebase-admin');

// ——————————————— 1) تهيئة Firebase Admin من JSON-stringified محفوظ في متغيّر البيئة
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (err) {
  console.error('❌ متغيّر FIREBASE_SERVICE_ACCOUNT غير موجود أو ليس بصيغة JSON صالحة.');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// ——————————————— 2) تهيئة Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ——————————————— 3) قراءة متغيّرات البيئة الأساسية
const {
  JWT_SECRET,
  SUPERVISOR_CODE,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_KEY
} = process.env;

if (!JWT_SECRET) {
  console.error('❌ متغيّر JWT_SECRET غير مُعرّف.');
  process.exit(1);
}
if (!SUPERVISOR_CODE) {
  console.error('❌ متغيّر SUPERVISOR_CODE غير مُعرّف.');
  process.exit(1);
}
if (!SHEET_ID) {
  console.error('❌ متغيّر GOOGLE_SHEET_ID غير مُعرّف.');
  process.exit(1);
}

let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch (err) {
  console.error('❌ متغيّر GOOGLE_SERVICE_KEY غير موجود أو ليس بصيغة JSON صالحة.');
  process.exit(1);
}

// ——————————————— 4) Middleware للتحقّق من JWT
function authenticate(req, res, next) {
  const h = req.headers.authorization;
  if (!h || !h.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// ——————————————— 5) دوال الوصول إلى Google Sheets
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

// ——————————————— 6) مسار تسجيل الدخول (/api/login) يصدر JWT
app.post('/api/login', async (req, res) => {
  const { code, pass } = req.body;
  if (!code || !pass) {
    return res.status(400).json({ error: 'code and pass required' });
  }
  try {
    const { headers, data } = await readSheet('Users');
    const iC = headers.indexOf('كود الموظف');
    const iP = headers.indexOf('كلمة المرور');
    const iN = headers.indexOf('الاسم');

    const row = data.find(r =>
      String(r[iC]).trim() === code &&
      String(r[iP]).trim() === pass
    );
    if (!row) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const payload = { code, name: row[iN] };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, user: payload });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ——————————————— 7) تخزينُ مؤقّت لتوكنات FCM
const tokens = new Map();
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) {
    return res.status(400).json({ error: 'user and token required' });
  }
  tokens.set(token, user);
  return res.json({ success: true });
});

// ——————————————— 8) مسار جلب بيانات “Users” (محميٌّ بالمشرف فقط)
app.get('/api/users', authenticate, async (req, res) => {
  // نتحقّق أنهم مشرف
  if (req.user.code !== SUPERVISOR_CODE) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  try {
    const result = await readSheet('Users');
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// ——————————————— 9) مسارات Attendance و Hwafez (كل موظف يرى فقط بياناته)
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    const idx = headers.indexOf('رقم الموظف');
    const filtered = data.filter(r => String(r[idx]).trim() === req.user.code);
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/hwafez', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx = headers.indexOf('رقم الموظف');
    const filtered = data.filter(r => String(r[idx]).trim() === req.user.code);
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

// ——————————————— 10) إرسال إشعار FCM (للمشرف فقط) باستخدام sendMulticast
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { title, body } = req.body;
  const tokensList = Array.from(tokens.keys());
  if (tokensList.length === 0) {
    return res.json({ success: true, sent: 0, message: 'لا توجد توكنات مسجلة.' });
  }

  const message = {
    notification: { title, body },
    tokens: tokensList
  };

  try {
    const response = await admin.messaging().sendMulticast(message);
    return res.json({ success: true, sent: response.successCount });
  } catch (err) {
    console.error('FCM error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// ——————————————— 11) SPA fallback & تشغيل السيرفر
app.get(/.*/, (_, r) => r.sendFile(path.join(__dirname, 'public', 'index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
