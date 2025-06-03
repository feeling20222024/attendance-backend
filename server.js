// server.js

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
   -------------------------------------------------------------
   تُطبّق على النصّ كاملاً وتعيد النصّ بعد التعويض.
   ————————————————————————————————————————————————————————————— */
function normalizeDigits(str) {
  if (!str) return str;
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    // العربية ٠..٩ => 0..9
    if (code >= 0x0660 && code <= 0x0669) {
      return String(code - 0x0660);
    }
    // الفارسية ۰..۹ => 0..9
    if (code >= 0x06F0 && code <= 0x06F9) {
      return String(code - 0x06F0);
    }
    return ch;
  });
}

/* —————————————————————————————————————————————————————————————
   3) تهيئة Firebase Admin باستخدام JSON مخزّن في المتغيّر البيئي
   -------------------------------------------------------------
   تأكد أنّ FIREBASE_SERVICE_ACCOUNT يحتوي على JSON صالح لحساب خدمة Firebase Admin.
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
   4) تهيئة Express
   -------------------------------------------------------------
   CORS و body parsing و إعطاء صلاحية لخدمة الملفات الثابتة في مجلّد public
   ————————————————————————————————————————————————————————————— */
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/* —————————————————————————————————————————————————————————————
   5) قراءة متغيّرات البيئة الأساسية
   -------------------------------------------------------------
   - JWT_SECRET: السرّ الذي نستخدمه لتوقيع وفكّ تشفير التوكن.
   - SUPERVISOR_CODE: كود الموظّف الذي هو مشرف.
   - GOOGLE_SHEET_ID: معرّف Google Spreadsheet.
   - GOOGLE_SERVICE_KEY: JSON string لمفتاح خدمة Google Sheets.
   ————————————————————————————————————————————————————————————— */
const {
  JWT_SECRET,
  SUPERVISOR_CODE,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_KEY
} = process.env;

if (!JWT_SECRET) {
  console.error('❌ خطأ: متغيّر JWT_SECRET غير معروف.');
  process.exit(1);
}
if (!SUPERVISOR_CODE) {
  console.error('❌ خطأ: متغيّر SUPERVISOR_CODE غير معروف.');
  process.exit(1);
}
if (!SHEET_ID) {
  console.error('❌ خطأ: متغيّر GOOGLE_SHEET_ID غير معروف.');
  process.exit(1);
}

let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch {
  console.error('❌ خطأ: متغيّر GOOGLE_SERVICE_KEY غير موجود أو ليس بصيغة JSON صالحة.');
  process.exit(1);
}

/* —————————————————————————————————————————————————————————————
   6) دوال الوصول إلى Google Sheets (إصدار 3.3.0)
   -------------------------------------------------------------
   نستخدم useServiceAccountAuth الموجودة في v3.3.0 لتسجيل الدخول إلى شيت.
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
   7) Middleware للتحقّق من JWT
   -------------------------------------------------------------
   أيّ طلب إلى مسار محميّ يجب أن يحمل هيدر:
     Authorization: Bearer <token>
   نفكّ تشفير التوكن ونخزّن بيانات المستخدم في req.user
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
   8) مسار تسجيل الدخول (/api/login)
   -------------------------------------------------------------
   يتلقى { code, pass } في جسم الطلب JSON،
   يطبّق normalizeDigits قبل البحث داخل شيت “Users”،
   ثمّ يصدر JWT إذا كان المستخدم صحيحاً.
   ————————————————————————————————————————————————————————————— */
app.post('/api/login', async (req, res) => {
  let { code, pass } = req.body;
  if (!code || !pass) {
    return res.status(400).json({ error: 'code and pass required' });
  }

  // نطبّق normalizeDigits على المدخلات
  code = normalizeDigits(String(code).trim());
  pass = normalizeDigits(String(pass).trim());

  try {
    const { headers, data } = await readSheet('Users');
    const iC = headers.indexOf('كود الموظف');
    const iP = headers.indexOf('كلمة المرور');
    const iN = headers.indexOf('الاسم');

    // نبحث في بيانات الشيت بعد تطبيق normalizeDigits على كل خلية
    const row = data.find(r => {
      const cellCode = normalizeDigits(String(r[iC] ?? '').trim());
      const cellPass = normalizeDigits(String(r[iP] ?? '').trim());
      return (cellCode === code && cellPass === pass);
    });

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

/* —————————————————————————————————————————————————————————————
   9) مسار لإرجاع بيانات "المستخدم الحالي" فقط (/api/me)
   -------------------------------------------------------------
   يحتاج JWT صالح في الهيدر. نبحث في شيت “Users” عن الكود المطابق.
   ————————————————————————————————————————————————————————————— */
app.get('/api/me', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Users');
    const idxCode = headers.indexOf('كود الموظف');
    const target  = normalizeDigits(String(req.user.code).trim());
    const row     = data.find(r => normalizeDigits(String(r[idxCode] ?? '').trim()) === target);
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    const single = {};
    headers.forEach((h, i) => (single[h] = row[i] ?? ''));
    return res.json({ user: single });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
});

/* —————————————————————————————————————————————————————————————
   10) مسار /api/attendance (محميّ بالـ JWT)
   -------------------------------------------------------------
   يعيد فقط الصفوف التي تطابق كود الموظّف الحالي في شيت “Attendance”.
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
   11) مسار /api/hwafez (محميّ بالـ JWT)
   -------------------------------------------------------------
   يعيد فقط الصفوف التي تطابق كود الموظّف الحالي في شيت “hwafez”.
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

/* —————————————————————————————————————————————————————————————
   12) مسار تسجيل توكن FCM (مؤقتاً في Map)
   -------------------------------------------------------------
   يطلب { user, token } في JSON. نخزّن التوكن في خريطة Map.
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
   13) مسار /api/notify-all لإرسال إشعار FCM (للمشرف فقط)
   -------------------------------------------------------------
   يحتاج JWT في الهيدر، ويتحقق أنّ req.user.code === SUPERVISOR_CODE.
   نرسل كل رسالة على حدة باستخدام admin.messaging().send().
   ————————————————————————————————————————————————————————————— */
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { title, body } = req.body;
  const list = Array.from(tokens.keys());
  console.log('🔸 Tokens currently in memory:', list);

  if (list.length === 0) {
    console.log('⚠️ لا يوجد توكنات مسجّلة، لن يتم إرسال إشعار.');
    return res.json({ success: true, sent: 0 });
  }

  // ننشئ مصفوفة وعود لكل توكن.
  const sendPromises = list.map(token => {
    return admin.messaging().send({
      token,
      notification: { title, body }
    });
  });

  // نستخدم allSettled لحساب عدد الرسائل التي أرسلناها بنجاح
  const results = await Promise.allSettled(sendPromises);
  const successCount = results.filter(r => r.status === 'fulfilled').length;
  const failCount    = results.length - successCount;

  if (failCount > 0) {
    console.warn(`⚠️ فشل إرسال الإشعار إلى ${failCount} جهاز/أجهزة.`);
    results
      .forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.warn(`   • Token ${list[idx]}  → خطأ:`, r.reason);
        }
      });
  }

  console.log(`✅ أرسل إشعار إلى ${successCount} جهاز، فشل ${failCount} جهاز.`);
  return res.json({ success: true, sent: successCount });
});

/* —————————————————————————————————————————————————————————————
   14) SPA fallback & تشغيل الخادم
   -------------------------------------------------------------
   أيّ طلب غير مطابق لأيّ مسار سابق سيردّ index.html
   ————————————————————————————————————————————————————————————— */
app.get(/.*/, (_, r) =>
  r.sendFile(path.join(__dirname, 'public', 'index.html'))
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
