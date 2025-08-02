require('dotenv').config();
const express               = require('express');
const cors                  = require('cors');
const path                  = require('path');
const jwt                   = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin                 = require('firebase-admin');

// —————————————————————————————————————————
// 1) قراءة المتغيّرات والتهيئة
// —————————————————————————————————————————
const APP_VERSION     = process.env.APP_VERSION     || '1.0.0';
const PORT            = process.env.PORT            || 3000;
const {
  JWT_SECRET,
  SUPERVISOR_CODE,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_KEY,
  FIREBASE_SERVICE_ACCOUNT
} = process.env;

if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !GOOGLE_SERVICE_KEY || !FIREBASE_SERVICE_ACCOUNT) {
  console.error('❌ بعض متغيرات البيئة مفقودة: يجب تعيين JWT_SECRET, SUPERVISOR_CODE, GOOGLE_SHEET_ID, GOOGLE_SERVICE_KEY, FIREBASE_SERVICE_ACCOUNT');
  process.exit(1);
}

// 2) دالة لتحويل الأرقام العربية/الفارسية إلى لاتينية
function normalizeDigits(str) {
  if (!str) return '';
  return str.replace(/[٠-٩۰-۹]/g, ch => {
    const c = ch.charCodeAt(0);
    if (c >= 0x0660 && c <= 0x0669) return String(c - 0x0660);
    if (c >= 0x06F0 && c <= 0x06F9) return String(c - 0x06F0);
    return ch;
  });
}

// 3) تهيئة Firebase Admin من متغير البيئة
let serviceAccount;
try {
  serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT ليس JSON صالح:', e);
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 4) مساعد لإرسال FCM
const tokens = new Map();
async function sendPushTo(token, title, body, data = {}) {
  const msg = {
    token,
    notification: { title, body },
    android: {
      ttl: 172800000, // 48 ساعة بالميلي ثانية
      priority: 'high',
      notification: {
        android_channel_id: 'default',
        sound:             'default',
        vibrate_timings:   [100, 200, 100]
      }
    },
    data
  };
  try {
    await admin.messaging().send(msg);
    console.log(`✅ FCM sent to ${token}`);
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered') {
      tokens.delete(token);
    } else {
      console.error(`❌ FCM failed for ${token}:`, err);
    }
  }
}

// 5) إعداد Express مع CORS
const app = express();
app.use(cors({
  origin: true,
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 6) تهيئة Google Sheets من متغير البيئة
let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch (e) {
  console.error('❌ GOOGLE_SERVICE_KEY ليس JSON صالح:', e);
  process.exit(1);
}

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
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) throw new Error(`Sheet "${title}" غير موجود`);
  await sheet.loadHeaderRow();
  const headers = sheet.headerValues;
  const rows = await sheet.getRows();
  const data = rows.map(r => headers.map(h => r[h] || ''));
  return { headers, data };
}

// 7) Middleware للتحقّق من JWT
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

// 8) المسارات
app.post('/api/login', async (req, res) => {
  let { code, pass } = req.body;
  if (!code || !pass) return res.status(400).json({ error: 'code and pass required' });
  code = normalizeDigits(code.trim());
  pass = normalizeDigits(pass.trim());
  try {
    const { headers, data } = await readSheet('Users');
    const iC = headers.indexOf('كود الموظف');
    const iP = headers.indexOf('كلمة المرور');
    const iN = headers.indexOf('الاسم');
    const row = data.find(r =>
      normalizeDigits((r[iC] || '').trim()) === code &&
      normalizeDigits((r[iP] || '').trim()) === pass
    );
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    const payload = { code, name: row[iN] };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, user: payload });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    const idx = headers.indexOf('رقم الموظف');
    const code = normalizeDigits(String(req.user.code).trim());
    const userRows = data.filter(r => normalizeDigits((r[idx] || '').trim()) === code);
    const generalRows = data.filter(r => !(r[idx] || '').toString().trim());
    const noteCol = headers.indexOf('تنبيهات وملاحظات عامة لجميع العاملين');
    const generalNote = generalRows[0]?.[noteCol]?.trim() || '';
    return res.json({ headers, data: userRows, generalNote });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/hwafez', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx = headers.indexOf('رقم الموظف');
    const code = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r => normalizeDigits((r[idx] || '').trim()) === code);
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.get('/api/tqeem', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('tqeem');
    const idx = headers.indexOf('رقم الموظف');
    const code = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r => normalizeDigits((r[idx] || '').trim()) === code);
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

app.post('/api/register-token', authenticate, (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) return res.status(400).json({ error: 'user and token required' });
  tokens.set(token, user);
  return res.json({ success: true });
});

app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) return res.status(403).json({ error: 'Forbidden' });
  const { title, body } = req.body;
  await Promise.allSettled(
    Array.from(tokens.keys()).map(t => sendPushTo(t, title, body))
  );
  return res.json({ success: true });
});

// سجل إشعارات المستخدم (ذاكرة)
const userNotifications = {};
app.post('/api/notifications', authenticate, (req, res) => {
  const { title, body, time } = req.body;
  if (!title || !body || !time) return res.status(400).json({ error: 'Missing fields' });
  const code = req.user.code;
  userNotifications[code] = userNotifications[code] || [];
  userNotifications[code].unshift({ title, body, time });
  if (userNotifications[code].length > 50) userNotifications[code].pop();
  return res.json({ success: true });
});
app.get('/api/notifications', authenticate, (req, res) => {
  return res.json({ notifications: userNotifications[req.user.code] || [] });
});

app.get('/api/version', (_, res) => res.json({ version: APP_VERSION }));
app.get(/.*/, (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

app.listen(PORT, () => console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`));
