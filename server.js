// server.js

require('dotenv').config();
const express                = require('express');
const cors                   = require('cors');
const path                   = require('path');
const { GoogleSpreadsheet }  = require('google-spreadsheet');
const admin                  = require('firebase-admin');

// ——————————————— 1) تهيئة Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// ——————————————— 2) تهيئة Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ——————————————— 3) قراءة متغيّرات البيئة
const SHEET_ID   = process.env.GOOGLE_SHEET_ID;
const sheetCreds = JSON.parse(process.env.GOOGLE_SERVICE_KEY);

// ——————————————— 4) دوال مساعدة للوصول إلى Google Sheets
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

// ——————————————— 5) “Login” endpoint: يتحقق من (code + pass) مقابل شيت “Users”
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
    // نعيد كود الموظف واسم الموظف في الاستجابة:
    return res.json({
      user: {
        code: code,
        name: String(row[iName] || '').trim()
      }
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ——————————————— 6) مسارات القراءة (Users, Attendance, hwafez)
app.get('/api/users', async (req, res) => {
  try {
    res.json(await readSheet('Users'));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/attendance', async (req, res) => {
  try {
    res.json(await readSheet('Attendance'));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.get('/api/hwafez', async (req, res) => {
  try {
    res.json(await readSheet('hwafez'));
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// ——————————————— 7) تسجيل توكن FCM مؤقتًا في Map
const tokens = new Map();
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) {
    return res.status(400).json({ error: 'user and token required' });
  }
  tokens.set(token, user);
  return res.json({ success: true });
});

// ——————————————— 8) إرسال إشعار FCM إلى كل التوكنات
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

// ——————————————— 9) SPA fallback & تشغيل السيرفر
app.get(/.*/, (_, r) => r.sendFile(path.join(__dirname, 'public', 'index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on ${PORT}`));
