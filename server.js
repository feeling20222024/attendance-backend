// 1) تحميل متغيّرات البيئة (سيقرأ ملف .env أو المتغيرات معرفة على Render)
require('dotenv').config();

const express               = require('express');
const cors                  = require('cors');
const path                  = require('path');
const jwt                   = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin                 = require('firebase-admin');

/* —————————————————————————————————————————————————————————————
   2) دالة لتحويل الأرقام العربية/الفارسية إلى لاتينية
   ————————————————————————————————————————————————————————————— */
function normalizeDigits(str) {
  if (!str) return str;
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    return ch;
  });
}

/* —————————————————————————————————————————————————————————————
   3) تهيئة Firebase Admin باستخدام JSON من المتغيّرات البيئية
   ————————————————————————————————————————————————————————————— */
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch {
  console.error('❌ خطأ: متغيّر FIREBASE_SERVICE_ACCOUNT غير موجود أو ليس بصيغة JSON صالحة.');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
/* —————————————————————————————————————————————————————————————
/* —————————————————————————————————————————————————————————————
   4) دالة لإرسال إشعار FCM إلى توكن معيّن (مع android_channel_id + sound + vibrate)
   ————————————————————————————————————————————————————————————— */
async function sendPushTo(token, title, body, data = {}) {
  const message = {
    token,
    notification: {
      title,
      body
    },
    android: {
      priority: 'high',
      notification: {
        android_channel_id: 'default', // ← نفس الـ id الذي أنشأته في setupChannels()
        sound:             'default',  // لتشغيل الصوت الافتراضي
        vibrate_timings:   [100, 200, 100]
      }
    },
    data  // إذا كان لديك بيانات إضافية تريد إرسالها
  };

  try {
    const resp = await admin.messaging().send(message);
    console.log(`✅ تم الإرسال إلى ${token}: ${resp}`);
  } catch (err) {
    console.error(`❌ فشل الإرسال إلى ${token}:`, err);
  }
}
/* —————————————————————————————————————————————————————————————
   5) تهيئة Express
   ————————————————————————————————————————————————————————————— */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* —————————————————————————————————————————————————————————————
   6) قراءة متغيّرات البيئة الأساسية
   ————————————————————————————————————————————————————————————— */
const {
  JWT_SECRET,
  SUPERVISOR_CODE,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_KEY
} = process.env;

if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !GOOGLE_SERVICE_KEY) {
  console.error('❌ خطأ: بعض متغيّرات البيئة مفقودة.');
  process.exit(1);
}

let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch {
  console.error('❌ خطأ: GOOGLE_SERVICE_KEY ليس بصيغة JSON صالحة.');
  process.exit(1);
}

/* —————————————————————————————————————————————————————————————
   7) دوال الوصول إلى Google Sheets
   ————————————————————————————————————————————————————————————— */
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
  const doc   = await accessSheet();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) throw new Error(`Sheet "${title}" not found`);
  await sheet.loadHeaderRow();
  const headers = sheet.headerValues;
  const rows    = await sheet.getRows();
  const data    = rows.map(r => headers.map(h => r[h] ?? ''));
  return { headers, data };
}

/* —————————————————————————————————————————————————————————————
   8) Middleware للتحقّق من JWT
   ————————————————————————————————————————————————————————————— */
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

/* —————————————————————————————————————————————————————————————
   9) تسجيل الدخول
   ————————————————————————————————————————————————————————————— */
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
      const cellCode = normalizeDigits(String(r[iC] ?? '').trim());
      const cellPass = normalizeDigits(String(r[iP] ?? '').trim());
      return (cellCode === code && cellPass === pass);
    });

    if (!row) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { code, name: row[iN] };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
    return res.json({ token, user: payload });

  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

/* —————————————————————————————————————————————————————————————
   10) معلومات المستخدم الحالي
   ————————————————————————————————————————————————————————————— */
app.get('/api/me', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Users');
    const idxCode = headers.indexOf('كود الموظف');
    const target  = normalizeDigits(String(req.user.code).trim());
    const row     = data.find(r => normalizeDigits(String(r[idxCode] ?? '').trim()) === target);
    if (!row) return res.status(404).json({ error: 'User not found' });

    const single = {};
    headers.forEach((h, i) => (single[h] = row[i] ?? ''));
    return res.json({ user: single });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

/* —————————————————————————————————————————————————————————————
   11) الحضور
   ————————————————————————————————————————————————————————————— */
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    const idx    = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r =>
      normalizeDigits(String(r[idx] ?? '').trim()) === target
    );
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

/* —————————————————————————————————————————————————————————————
   12) الحوافز
   ————————————————————————————————————————————————————————————— */
app.get('/api/hwafez', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx    = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r =>
      normalizeDigits(String(r[idx] ?? '').trim()) === target
    );
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

   13) التقييم السنوي
   ————————————————————————————————————————————————————————————— */
app.get('/api/tqeem', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('tqeem');
    const idx    = headers.indexOf('رقم الموظف');
    const target = normalizeDigits(String(req.user.code).trim());
    const filtered = data.filter(r =>
      normalizeDigits(String(r[idx] ?? '').trim()) === target
    );
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});




/* —————————————————————————————————————————————————————————————
   14) تسجيل توكن FCM
   ————————————————————————————————————————————————————————————— */
const tokens = new Map();
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) {
    return res.status(400).json({ error: 'user and token required' });
  }
  console.log(`🔹 Registering FCM token for user=${user}: ${token}`);
  tokens.set(token, user);
  return res.json({ success: true });
});

/* —————————————————————————————————————————————————————————————
   15) إرسال إشعارات لجميع التوكنات (للمشرف فقط)
   ————————————————————————————————————————————————————————————— */
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { title, body } = req.body;
  const list = Array.from(tokens.keys());

  if (list.length === 0) {
    console.log('⚠️ لا يوجد توكنات مسجّلة.');
    return res.json({ success: true, sent: 0 });
  }

  const results = await Promise.allSettled(
    list.map(token => sendPushTo(token, title, body))
  );

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failCount    = results.length - successCount;

  if (failCount > 0) {
    console.warn(`⚠️ فشل إرسال الإشعار إلى ${failCount} جهاز/أجهزة.`);
  }

  console.log(`✅ أرسل إشعار إلى ${successCount} جهاز.`);
  return res.json({ success: true, sent: successCount });
});

/* —————————————————————————————————————————————————————————————
   16) SPA fallback & تشغيل الخادم
   ————————————————————————————————————————————————————————————— */
app.get(/.*/, (_, r) =>
  r.sendFile(path.join(__dirname, 'public', 'index.html'))
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 الخادم يعمل على المنفذ ${PORT}`);
});
