// 1) تحميل متغيّرات البيئة (يُستخدم محليًا فقط)
require('dotenv').config();

const express          = require('express');
const cors             = require('cors');
const path             = require('path');
const jwt              = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin            = require('firebase-admin');

// 2) Firebase Admin
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 3) إعداد Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 4) JWT & المشرف
const JWT_SECRET      = process.env.JWT_SECRET;
const SUPERVISOR_CODE = process.env.SUPERVISOR_CODE;

// 5) Middleware للتحقّق من الـ JWT
function authenticate(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.user = jwt.verify(auth.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// 6) مسار تسجيل الدخول لإصدار JWT
app.post('/api/login', async (req, res) => {
  const { code, pass } = req.body;
  if (!code || !pass) return res.status(400).json({ error: 'code and pass required' });
  try {
    const { headers, data } = await readSheet('Users');
    const iCode = headers.indexOf('كود الموظف');
    const iPass = headers.indexOf('كلمة المرور');
    const iName = headers.indexOf('الاسم');
    const row = data.find(r =>
      String(r[iCode]).trim() === code &&
      String(r[iPass]).trim() === pass
    );
    if (!row) return res.status(401).json({ error: 'Invalid credentials' });
    const payload = { code, name: row[iName] };
    const token   = jwt.sign(payload, JWT_SECRET, { expiresIn: '12h' });
    res.json({ token, user: payload });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 7) توكنات FCM مؤقتة
const tokens = new Map();
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) return res.status(400).json({ error: 'user and token required' });
  tokens.set(token, user);
  res.json({ success: true });
});

// 8) إعداد Google Sheets
const SHEET_ID   = process.env.GOOGLE_SHEET_ID;
const sheetCreds = JSON.parse(process.env.GOOGLE_SERVICE_KEY);

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

// 9) مسارات البيانات (محميّة)
app.get('/api/users',     authenticate, async (req, res) => {
  try { res.json(await readSheet('Users')); }
  catch(e){ res.status(500).json({ error: e.message }); }
});
app.get('/api/attendance', authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('Attendance');
    // إرجاع صفوف المستخدم الحالي فقط
    const idxCode = headers.indexOf('رقم الموظف');
    const filtered = data.filter(r => String(r[idxCode]).trim() === req.user.code);
    res.json({ headers, data: filtered });
  } catch(e){
    res.status(500).json({ error: e.message });
  }
});
app.get('/api/hwafez',    authenticate, async (req, res) => {
  try {
    const { headers, data } = await readSheet('hwafez');
    const idxCode = headers.indexOf('رقم الموظف');
    const filtered = data.filter(r => String(r[idxCode]).trim() === req.user.code);
    res.json({ headers, data: filtered });
  } catch(e){
    res.status(500).json({ error: e.message });
  }
});

// 10) إرسال إشعار (يُسمح للمشرف فقط)
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
    res.json({ success: true, sent });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

// 11) SPA fallback + تشغيل الخادم
app.get(/.*/, (_,res) => res.sendFile(path.join(__dirname,'public','index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Listening on port ${PORT}`));
