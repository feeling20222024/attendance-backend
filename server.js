// server.js

// 1) تحميل متغيّرات البيئة
require('dotenv').config();

const express               = require('express');
const cors                  = require('cors');
const path                  = require('path');
const jwt                   = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin                 = require('firebase-admin');

// 2) دالة لتحويل الأرقام العربية/الفارسية إلى لاتينية
function normalizeDigits(str) {
  if (!str) return str;
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    return ch;
  });
}

// 3) تهيئة Firebase Admin
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch {
  console.error('❌ خطأ: FIREBASE_SERVICE_ACCOUNT غير صالح.');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 3.1) ربط Firestore
const db = admin.firestore();

// 4) دالة لإرسال إشعار FCM
async function sendPushTo(token, title, body, data = {}) {
  const message = {
    token,
    notification: { title, body },
    webpush: {
      headers: { TTL: '86400' },
      notification: { title, body }
    },
    android: {
      ttl: 172800000,
      priority: 'high',
      notification: {
        channel_id: 'default',
        sound: 'default'
      }
    },
    data
  };
  return admin.messaging().send(message);
}

// 5) تهيئة Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 6) قراءة متغيّرات البيئة الأساسية
const {
  JWT_SECRET,
  SUPERVISOR_CODE,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_KEY
} = process.env;

if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !GOOGLE_SERVICE_KEY) {
  console.error('❌ بعض متغيرات البيئة مفقودة.');
  process.exit(1);
}

let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch {
  console.error('❌ GOOGLE_SERVICE_KEY ليس JSON صالح.');
  process.exit(1);
}

// 7) دوال الوصول إلى Google Sheets
async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: sheetCreds.client_email,
    private_key: sheetCreds.private_key.replace(/\\n/g, '\n')
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

// 9) تسجيل الدخول
app.post('/api/login', async (req, res) => {
  let { code, pass } = req.body;
  if (!code || !pass) return res.status(400).json({ error: 'code and pass required' });

  code = normalizeDigits(String(code).trim());
  pass = normalizeDigits(String(pass).trim());

  try {
    const { headers, data } = await readSheet('Users');
    const iC = headers.indexOf('كود الموظف');
    const iP = headers.indexOf('كلمة المرور');
    const iN = headers.indexOf('الاسم');

    const row = data.find(r => {
      return normalizeDigits(r[iC].trim()) === code
          && normalizeDigits(r[iP].trim()) === pass;
    });
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { code, name: row[iN] };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: payload });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 10) معلومات المستخدم الحالي
app.get('/api/me', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Users');
    const idxCode = headers.indexOf('كود الموظف');
    const target  = normalizeDigits(req.user.code);
    const row     = data.find(r => normalizeDigits(r[idxCode].trim()) === target);
    if (!row) return res.status(404).json({ error: 'User not found' });
    const single = {};
    headers.forEach((h,i) => single[h] = row[i] ?? '');
    res.json({ user: single });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 11) attendance, hwafez, tqeem (كما في السابق)
app.get('/api/attendance', authenticate, async (req, res) => {
  const { headers, data } = await readSheet('Attendance');
  const idx    = headers.indexOf('رقم الموظف');
  const target = normalizeDigits(req.user.code);
  res.json({
    headers,
    data: data.filter(r => normalizeDigits(r[idx].trim()) === target)
  });
});
app.get('/api/hwafez', authenticate, async (req, res) => {
  const { headers, data } = await readSheet('hwafez');
  const idx    = headers.indexOf('رقم الموظف');
  const target = normalizeDigits(req.user.code);
  res.json({
    headers,
    data: data.filter(r => normalizeDigits(r[idx].trim()) === target)
  });
});
app.get('/api/tqeem', authenticate, async (req, res) => {
  const { headers, data } = await readSheet('tqeem');
  const idx    = headers.indexOf('رقم الموظف');
  const target = normalizeDigits(req.user.code);
  res.json({
    headers,
    data: data.filter(r => normalizeDigits(r[idx].trim()) === target)
  });
});

// 12) تخزين وتحديث توكنات FCM في Firestore
const tokensCollection = db.collection('fcmTokens');

app.post('/api/register-token', authenticate, async (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) {
    return res.status(400).json({ error: 'user and token required' });
  }
  try {
    await tokensCollection.doc(token).set({ user });
    res.json({ success: true });
  } catch (e) {
    console.error('❌ Failed to store FCM token:', e);
    res.status(500).json({ error: 'Failed to store token' });
  }
});

// 13) notify-all مع تنظيف التوكنات المنتهية
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { title, body } = req.body;

  try {
    const snap    = await tokensCollection.get();
    const tokens  = snap.docs.map(d => d.id);
    const results = await Promise.allSettled(
      tokens.map(token =>
        sendPushTo(token, title, body).catch(err => {
          if (err.errorInfo?.code === 'messaging/registration-token-not-registered') {
            return tokensCollection.doc(token).delete();
          }
          throw err;
        })
      )
    );
    res.json({ success: true, results });
  } catch (e) {
    console.error('❌ notify-all failed:', e);
    res.status(500).json({ error: 'Failed to send notifications' });
  }
});

// 14) latest-version
app.get('/api/latest-version', (req, res) => {
  res.json({
    latest:    '1.0.0',
    updateUrl: 'https://play.google.com/store/apps/details?id=com.example.app'
  });
});

// 15) تخزين الإشعارات في Firestore
app.post('/api/notifications', authenticate, async (req, res) => {
  const { title, body, time } = req.body;
  if (!title || !body || !time) {
    return res.status(400).json({ error: 'title, body, time required' });
  }
  try {
    await db.collection('notifications').add({
      user:      req.user.code,
      title,
      body,
      time,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    res.json({ success: true });
  } catch (e) {
    console.error('❌ Firestore write failed:', e);
    res.status(500).json({ error: 'Failed to save notification' });
  }
});

// 16) جلب إشعارات المستخدم
app.get('/api/notifications', authenticate, async (req, res) => {
  try {
    const snap = await db.collection('notifications')
      .where('user', '==', req.user.code)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();
    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ data });
  } catch (e) {
    console.error('❌ Firestore read failed:', e);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// 17) SPA fallback
app.get(/.*/, (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// 18) بدء الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 الخادم يعمل على ${PORT}`));
