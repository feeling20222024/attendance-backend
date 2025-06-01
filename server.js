// server.js

require('dotenv').config();
const express               = require('express');
const cors                  = require('cors');
const path                  = require('path');
const admin                 = require('firebase-admin');

// ————————— 1) إعداد Firebase Admin
let serviceAccount;
try {
  // يُفترض أن FIREBASE_SERVICE_ACCOUNT هو كائن JSON مضغوط كسلسلة نصّية
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (err) {
  console.error('❌ خطأ: متغيّر FIREBASE_SERVICE_ACCOUNT غير موجود أو ليس بصيغة JSON صالحة.');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// ————————— 2) محاولة استيراد GoogleSpreadsheet لدعم الإصدارات v3.x وv4+
// بعض الإصدارات تَعُود مُباشرةً بالـ class، وأخرى تُعيده كخاصية داخل كائن.
let GoogleSpreadsheetClass;
try {
  // في حال الإصدارات الأحدث (v4 أو v5)، يكون الاستيراد بالشكل التالي:
  GoogleSpreadsheetClass = require('google-spreadsheet').GoogleSpreadsheet;
  if (!GoogleSpreadsheetClass) throw new Error();
} catch (e) {
  // في حال الإصدارات القديمة (v3.x)، تكون المكتبة مُصدّرة مباشرةً
  GoogleSpreadsheetClass = require('google-spreadsheet');
}

// ————————— 3) إعداد Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ————————— 4) قراءة متغيّرات البيئة الضرورية
const SHEET_ID   = process.env.GOOGLE_SHEET_ID;
const GOOGLE_KEY = process.env.GOOGLE_SERVICE_KEY;
if (!SHEET_ID) {
  console.error('❌ خطأ: متغيّر GOOGLE_SHEET_ID غير مُعرَّف في البيئة.');
  process.exit(1);
}
let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_KEY);
} catch (err) {
  console.error('❌ خطأ: متغيّر GOOGLE_SERVICE_KEY غير موجود أو ليس بصيغة JSON صالحة.');
  process.exit(1);
}

// ————————— 5) دوال مساعد للوصول إلى Google Sheets
async function accessSheet() {
  const doc = new GoogleSpreadsheetClass(SHEET_ID);

  // وظيفة المصادقة تختلف قليلًا بحسب الإصدار:
  // - في v3.x: doc.useServiceAccountAuth(credentials, callback)
  // - في v4+  : doc.useServiceAccountAuth(credentials) ← يعيد Promise
  const creds = {
    client_email: sheetCreds.client_email,
    private_key:  sheetCreds.private_key.replace(/\\n/g, '\n'),
  };

  // نتأكّد إذا كانت useServiceAccountAuth تُعيد Promise أو تأخذ callback
  if (typeof doc.useServiceAccountAuth === 'function') {
    // رُبَّما هي v4+ (تُعيد Promise)
    // نجرِّب الشرطين معًا:
    try {
      await doc.useServiceAccountAuth(creds);
    } catch (err) {
      // إذا كانت v3.x وكانت تنتظر callback، نستخدم الشكل القديم:
      await new Promise((resolve, reject) => {
        doc.useServiceAccountAuth(creds, (e) => (e ? reject(e) : resolve()));
      });
    }
  } else {
    throw new Error('doc.useServiceAccountAuth غير متاح في هذه النسخة من google-spreadsheet');
  }

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

// ————————— 6) مسار تسجيل الدخول (/api/login)
app.post('/api/login', async (req, res) => {
  const { code, pass } = req.body;
  if (!code || !pass) {
    return res.status(400).json({ error: 'code and pass required' });
  }
  try {
    const { headers, data } = await readSheet('Users');
    const iCode = headers.indexOf('كود الموظف');
    const iPass = headers.indexOf('كلمة المرور');
    const iName = headers.indexOf('الاسم');

    const row = data.find(r =>
      String(r[iCode]).trim() === code &&
      String(r[iPass]).trim() === pass
    );
    if (!row) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    return res.json({
      user: {
        code: code.trim(),
        name: String(row[iName] || '').trim()
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ————————— 7) مسارات القراءة (بدون حماية JWT)
app.get('/api/users', async (req, res) => {
  try {
    const result = await readSheet('Users');
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: e.message });
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    const result = await readSheet('Attendance');
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: e.message });
  }
});

app.get('/api/hwafez', async (req, res) => {
  try {
    const result = await readSheet('hwafeز');
    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(400).json({ error: e.message });
  }
});

// ————————— 8) تسجيل توكن FCM مؤقتًا
const tokens = new Map();
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) {
    return res.status(400).json({ error: 'user and token required' });
  }
  tokens.set(token, user);
  return res.json({ success: true });
});

// ————————— 9) إرسال إشعار FCM إلى جميع التوكنات
app.post('/api/notify-all', async (req, res) => {
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

// ————————— 10) SPA fallback & تشغيل السيرفر
app.get(/.*/, (_, r) => r.sendFile(path.join(__dirname, 'public', 'index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on ${PORT}`));
