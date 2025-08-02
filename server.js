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
  GOOGLE_SHEET_ID: SHEET_ID
} = process.env;

if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID) {
  console.error('❌ بعض متغيرات البيئة مفقودة (JWT_SECRET, SUPERVISOR_CODE, GOOGLE_SHEET_ID)');
  process.exit(1);
}

// —————————————————————————————————————————
// 2) دالة لتحويل الأرقام العربية/الفارسية إلى لاتينية
// —————————————————————————————————————————
function normalizeDigits(str) {
  if (!str) return '';
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const c = ch.charCodeAt(0);
    if (c >= 0x0660 && c <= 0x0669) return String(c - 0x0660);
    if (c >= 0x06F0 && c <= 0x06F9) return String(c - 0x06F0);
    return ch;
  });
}

// —————————————————————————————————————————
// 3) تهيئة Firebase Admin (serviceAccountKey.json)
// —————————————————————————————————————————
let serviceAccount;
try {
  serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
} catch (e) {
  console.error('❌ فشل تحميل serviceAccountKey.json:', e);
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// —————————————————————————————————————————
// 4) مساعد لإرسال FCM
// —————————————————————————————————————————
const tokens = new Map();
async function sendPushTo(token, title, body, data = {}) {
  const msg = {
    token,
    notification: { title, body },
    android: {
      ttl: '172800s', priority: 'high',
      notification: {
        android_channel_id: 'default',
        sound:             'default',
        vibrate_timings:   [100,200,100]
      }
    },
    data
  };
  try {
    const resp = await admin.messaging().send(msg);
    console.log(`✅ FCM sent to ${token}: ${resp}`);
  } catch (err) {
    if (err.code === 'messaging/registration-token-not-registered') {
      console.warn(`⚠️ حذف التوكن غير الصالح: ${token}`);
      tokens.delete(token);
    } else {
      console.error(`❌ FCM failed to ${token}:`, err);
    }
  }
}

// —————————————————————————————————————————
// 5) إعداد Express مع CORS يسمح لـ Authorization header
// —————————————————————————————————————————
const app = express();
app.use(cors({
  allowedHeaders: ['Content-Type','Authorization'],
  exposedHeaders: ['Authorization']
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// —————————————————————————————————————————
// 6) تهيئة Google Sheets (googleServiceAccount.json)
// —————————————————————————————————————————
let sheetCreds;
try {
  sheetCreds = require(path.join(__dirname, 'googleServiceAccount.json'));
} catch (e) {
  console.error('❌ فشل تحميل googleServiceAccount.json:', e);
  process.exit(1);
}
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

// —————————————————————————————————————————
// 7) Middleware للتحقّق من JWT
// —————————————————————————————————————————
function authenticate(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// —————————————————————————————————————————
// 8) المسارات (Routes)
// —————————————————————————————————————————

// 8.1) تسجيل الدخول
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
    console.error('Login exception:', e);
    res.status(500).json({ error:'Login failed' });
  }
});

// 8.2) حضور + ملاحظة عامة
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    const idx   = headers.indexOf('رقم الموظف');
    const code  = normalizeDigits(String(req.user.code).trim());
    const userRows   = data.filter(r=>normalizeDigits((r[idx]||'').trim())===code);
    const generalRows= data.filter(r=>!(r[idx]||'').toString().trim());
    const noteCol    = headers.indexOf('تنبيهات وملاحظات عامة لجميع العاملين');
    const generalNote= generalRows[0]?.[noteCol]?.trim()||'';
    res.json({ headers, data: userRows, generalNote });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:e.message });
  }
});

// 8.3) الحوافز
app.get('/api/hwafez', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx   = headers.indexOf('رقم الموظف');
    const code  = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r=>normalizeDigits((r[idx]||'').trim())===code);
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:e.message });
  }
});

// 8.4) التقييم السنوي
app.get('/api/tqeem', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('tqeem');
    const idx   = headers.indexOf('رقم الموظف');
    const code  = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r=>normalizeDigits((r[idx]||'').trim())===code);
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error:e.message });
  }
});

// 8.5) تسجيل توكن FCM
app.post('/api/register-token', authenticate, (req, res) => {
  const { user, token } = req.body;
  if (!user||!token) return res.status(400).json({ error:'user and token required' });
  tokens.set(token, user);
  res.json({ success:true });
});

// 8.6) إشعار للجميع (مشرف فقط)
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) {
    return res.status(403).json({ error:'Forbidden' });
  }
  const { title, body } = req.body;
  await Promise.allSettled(
    Array.from(tokens.keys()).map(t=>sendPushTo(t,title,body))
  );
  res.json({ success:true });
});

// 8.7) سجل إشعارات المستخدم (ذاكرة مؤقتة)
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

// 8.8) إصدار التطبيق
app.get('/api/version', (_, res) => {
  res.json({ version: APP_VERSION });
});

// —————————————————————————————————————————
// 9) SPA fallback
// —————————————————————————————————————————
app.get(/.*/, (_, res) =>
  res.sendFile(path.join(__dirname,'public','index.html'))
);

// —————————————————————————————————————————
// 10) بدء الخادم
// —————————————————————————————————————————
app.listen(PORT, ()=> {
  console.log(`🚀 الخادم يعمل على http://localhost:${PORT}`);
});
