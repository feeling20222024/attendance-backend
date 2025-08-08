// server.js (محدَّث كامل)
// 1) تحميل متغيّرات البيئة
require('dotenv').config();

const express               = require('express');
const cors                  = require('cors');
const path                  = require('path');
const jwt                   = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin                 = require('firebase-admin');
const { getFirestore }      = require('firebase-admin/firestore');

// 2) تهيئة Firebase Admin
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (err) {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT غير صالح أو غير موجود في الـ env.');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const db = getFirestore();

// 3) إنشاء التطبيق وإعداد CORS
const app = express();
const corsOptions = {
  origin: 'https://dwam-app-by-omar.netlify.app',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 4) إعدادات عامة
const APP_VERSION        = process.env.APP_VERSION        || '1.0.0';
const PORT               = process.env.PORT               || 3000;
const JWT_SECRET         = process.env.JWT_SECRET;
const SUPERVISOR_CODE    = process.env.SUPERVISOR_CODE;
const SHEET_ID           = process.env.GOOGLE_SHEET_ID;
const GOOGLE_SERVICE_KEY = process.env.GOOGLE_SERVICE_KEY;

if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !GOOGLE_SERVICE_KEY) {
  console.error('❌ بعض متغيرات البيئة مفقودة.');
  process.exit(1);
}

// 5) تطبيع الأرقام عربية→غربية
function normalizeDigits(str) {
  if (!str) return '';
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    return String(code & 0xF);
  });
}

// 6) إعداد Google Sheets (دوال مساعدة)
let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch {
  console.error('❌ GOOGLE_SERVICE_KEY ليس JSON صالح.');
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
  const doc   = await accessSheet();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) throw new Error(`Sheet "${title}" غير موجود`);
  await sheet.loadHeaderRow();

  const rawHeaders   = sheet.headerValues;
  const cleanHeaders = rawHeaders.map(h => h.trim());
  const rows = await sheet.getRows();
  const data = rows.map(r =>
    cleanHeaders.map(h => r[h] != null ? r[h] : '')
  );

  return { headers: cleanHeaders, data };
}

// 7) JWT Middleware
function authenticate(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// -------------------------
// إشعارات: الذاكرة + Firestore
// -------------------------
const tokens = new Map();              // token -> user (في الذاكرة)
const userNotifications = {};          // userCode -> [ { title, body, time } ]
const globalNotifications = [];        // سجل موحَّد (آخر 50)

// حذف توكن من Firestore (عند الحاجة)
async function deleteTokenFromFirestore(docId) {
  try {
    await db.collection('fcm_tokens').doc(docId).delete();
    console.log(`🗑️ Deleted token doc ${docId} from Firestore`);
  } catch (e) {
    console.warn('⚠️ deleteTokenFromFirestore failed', e);
  }
}

// دالة إرسال إشعار FCM مع تنظيف التوكنات غير الصالحة
async function sendPushTo(token, title, body, data = {}) {
  const message = {
    token,
    notification: { title, body },
    android: { ttl: 48 * 60 * 60 * 1000, priority: 'high' },
    data
  };
  try {
    await admin.messaging().send(message);
    console.log(`✅ تم الإرسال بنجاح إلى ${token}`);
  } catch (err) {
    console.error(`❌ فشل الإرسال إلى ${token}:`, err);
    // احذف من الذاكرة مؤقتًا
    tokens.delete(token);
    // احذف من Firestore إذا التوكن غير مسجّل
    if (err?.errorInfo?.code === 'messaging/registration-token-not-registered') {
      console.warn(`🗑️ حذف التوكن غير الصالح: ${token}`);
      await deleteTokenFromFirestore(token);
    }
  }
}

// -------------------------
// 10) تسجيل الدخول (نقطة النهاية)
// -------------------------
app.post('/api/login', cors(corsOptions), async (req, res) => {
  let { code, pass } = req.body;
  if (!code || !pass) {
    return res.status(400).json({ error: 'code and pass required' });
  }

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

    res.json({ token, user: payload });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// -------------------------
// 11) حضور + ملاحظات
// -------------------------
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');

    const idxEmp       = headers.indexOf('رقم الموظف');
    const colPersonal  = headers.indexOf('تنبيهات وملاحظات خاصة بالعامل');
    const colGeneral   = headers.indexOf('تنبيهات وملاحظات عامة لجميع العاملين');

    const empCode = normalizeDigits(String(req.user.code).trim());

    const userRows = data.filter(r =>
      normalizeDigits((r[idxEmp] || '').trim()) === empCode
    );

    const personalNote = userRows[0]?.[colPersonal]?.toString().trim() || '';
    const generalRow = data.find(r => !(r[idxEmp] || '').toString().trim());
    const generalNote = generalRow ? (generalRow[colGeneral] || '').toString().trim() : '';

    res.json({
      headers,
      data: userRows,
      personalNote,
      generalNote
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// -------------------------
// 12) الحوافز
// -------------------------
app.get('/api/hwafez', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx = headers.indexOf('رقم الموظف');
    const empCode = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r =>
      normalizeDigits((r[idx]||'').trim()) === empCode
    );
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// -------------------------
// 13) التقييم السنوي
// -------------------------
app.get('/api/tqeem', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('tqeem');
    const idx = headers.indexOf('رقم الموظف');
    const empCode = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r =>
      normalizeDigits((r[idx]||'').trim()) === empCode
    );
    res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// -------------------------
// 14) تسجيل توكن FCM (خزن في الذاكرة وفي Firestore)
// -------------------------
app.post(
  '/api/register-token',
  cors(corsOptions),
  authenticate,
  async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'token required' });

    // خزن محليًا في الذاكرة
    tokens.set(token, req.user);

    // خزن في Firestore (وثيقة مفتاحها هو التوكن)
    try {
      await db.collection('fcm_tokens').doc(token).set({
        token,
        user: req.user,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (e) {
      console.warn('⚠️ failed to persist token to Firestore', e);
    }

    res.json({ success: true });
  }
);

// -------------------------
// 15) إشعار للجميع + تخزين (المشرف فقط)
// -------------------------
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });

  const time = new Date().toISOString();

  // خزّن في السجل العام
  globalNotifications.unshift({ title, body, time });
  if (globalNotifications.length > 50) globalNotifications.pop();

  // اقرأ كل التوكنات من Firestore ثم أرسل لكل توكن
  try {
    const snap = await db.collection('fcm_tokens').get();
    const docs = snap.docs;
    const tokensList = docs.map(d => d.id);

    // أرسل FCM لكل توكن (عدم الإيقاف عند خطأ واحد)
    await Promise.allSettled(tokensList.map(t => sendPushTo(t, title, body)));

    // خزّن نسخة لكل مستخدم موجود في سجلات التوكنات
    docs.forEach(d => {
      const data = d.data();
      const userCode = data?.user?.code;
      if (!userCode) return;
      userNotifications[userCode] = userNotifications[userCode] || [];
      userNotifications[userCode].unshift({ title, body, time });
      if (userNotifications[userCode].length > 50) userNotifications[userCode].pop();
    });

    res.json({ success: true });
  } catch (e) {
    console.error('❌ notify-all error:', e);
    res.status(500).json({ error: 'notify failed' });
  }
});

// -------------------------
// 16) سجل الإشعارات الموحَّد
// -------------------------
app.get('/api/notifications', cors(corsOptions), authenticate, (req, res) => {
  const c = req.user.code;
  const personal = userNotifications[c] || [];
  const merged = [...personal, ...globalNotifications]
    .sort((a,b) => new Date(b.time) - new Date(a.time))
    .slice(0,50);
  res.json({ notifications: merged });
});

// endpoint عام قبل الدخول لإظهار الإشعارات العامة
app.get('/api/public-notifications', cors(corsOptions), (req, res) => {
  const out = globalNotifications.slice(0,50);
  res.json({ notifications: out });
});

// مسح الإشعارات (للمشرف) → يمسح personal + global
app.delete('/api/notifications', cors(corsOptions), authenticate, (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) return res.status(403).json({ error: 'Forbidden' });
  Object.keys(userNotifications).forEach(k => delete userNotifications[k]);
  globalNotifications.length = 0;
  res.json({ success: true });
});

// -------------------------
// 17) إصدار التطبيق + SPA fallback
// -------------------------
app.get('/api/version', (_, res) => res.json({ version: APP_VERSION }));

app.get(/.*/, (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// -------------------------
// 18) بدء الخادم
// -------------------------
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
