// server.js

require('dotenv').config();
const express                   = require('express');
const cors                      = require('cors');
const path                      = require('path');
const jwt                       = require('jsonwebtoken');
const { GoogleSpreadsheet }     = require('google-spreadsheet');
const admin                     = require('firebase-admin');

/*
  1) تهيئة Firebase Admin من JSON مخزّن في متغيّر البيئة:
     FIREBASE_SERVICE_ACCOUNT يجب أن يحتوي على JSON كامل (عبر Settings > Environment في Render).
*/
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

/*
  2) إعداد Express
*/
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/*
  3) قراءة المتغيّرات الأساسية من البيئة
     تأكدوا من تعيينها (Settings > Environment في Render أو في ملف .env محليّ).
*/
const {
  JWT_SECRET,
  SUPERVISOR_CODE,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_KEY
} = process.env;

if (!JWT_SECRET) {
  console.error('❌ خطأ: متغيّر JWT_SECRET غير مُعرّف في البيئة.');
  process.exit(1);
}
if (!SUPERVISOR_CODE) {
  console.error('❌ خطأ: متغيّر SUPERVISOR_CODE غير مُعرّف في البيئة.');
  process.exit(1);
}
if (!SHEET_ID) {
  console.error('❌ خطأ: متغيّر GOOGLE_SHEET_ID غير مُعرّف في البيئة.');
  process.exit(1);
}

let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch {
  console.error('❌ خطأ: متغيّر GOOGLE_SERVICE_KEY غير موجود أو ليس بصيغة JSON صالحة.');
  process.exit(1);
}

/*
  4) وظائف الوصول إلى Google Sheets
     – ننشئ مثيلاً جديداً من GoogleSpreadsheet
     – نستخدم useServiceAccountAuth (يوجد في الإصدارات الحديثة من google-spreadsheet)
     – ثم ننفّذ loadInfo() لتحميل بيانات الشيت
*/
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

/*
  5) Middleware للتحقّق من JWT
*/
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

/*
  6) مسار تسجيل الدخول (/api/login)
     – يقارن الكود وكلمة المرور مع شيت “Users”
     – إذا كانت صحيحة، يصدر JWT (حاملاً { code, name }) صلاحيتها 12 ساعة
*/
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

/*
  7) مسار /api/me لإرجاع صف المستخدم الحالي فقط (محمية بتوكين JWT)
*/
app.get('/api/me', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Users');
    const idxCode = headers.indexOf('كود الموظف');
    const row = data.find(r =>
      String(r[idxCode]).trim() === req.user.code
    );
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    // نصنع كائناً key=اسم العمود، value=قيمته في الصف
    const single = {};
    headers.forEach((h, i) => {
      single[h] = row[i] ?? '';
    });
    return res.json({ user: single });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

/*
  8) مسار /api/attendance لإرجاع سجلات “Attendance” للموظف الحالي فقط
*/
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    const idx = headers.indexOf('رقم الموظف');
    const filtered = data.filter(r =>
      String(r[idx]).trim() === req.user.code
    );
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

/*
  9) مسار /api/hwafez لإرجاع بيانات “hwafez” للموظف الحالي فقط
*/
app.get('/api/hwafez', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idx = headers.indexOf('رقم الموظف');
    const filtered = data.filter(r =>
      String(r[idx]).trim() === req.user.code
    );
    return res.json({ headers, data: filtered });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

/*
  10) مسار تسجيل توكين FCM (مؤقتًا في Map)
*/
const tokens = new Map();
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) {
    return res.status(400).json({ error: 'user and token required' });
  }
  tokens.set(token, user);
  return res.json({ success: true });
});

/*
  11) مسار /api/notify-all لإرسال إشعار FCM إلى كل التوكنات (للمشرف فقط)
*/
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { title, body } = req.body;
  const list = Array.from(tokens.keys());
  try {
    const resp = await admin.messaging().sendToDevice(list, {
      notification: { title, body }
    });
    const sent = resp.results.filter(r => !r.error).length;
    return res.json({ success: true, sent });
  } catch (err) {
    console.error('FCM error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/*
  12) SPA fallback & تشغيل السيرفر
*/
app.get(/.*/, (_, r) =>
  r.sendFile(path.join(__dirname, 'public', 'index.html'))
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
