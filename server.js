// server.js
const express               = require('express');
const cors                  = require('cors');
const path                  = require('path');
const jwt                   = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin                 = require('firebase-admin');

// === Firebase Admin ===
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// === Express setup ===
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === Config from env ===
const JWT_SECRET      = process.env.JWT_SECRET;
const SUPERVISOR_CODE = process.env.SUPERVISOR_CODE;
const SHEET_ID        = process.env.GOOGLE_SHEET_ID;
const sheetCreds      = JSON.parse(process.env.GOOGLE_SERVICE_KEY);

// === JWT middleware ===
function authenticate(req, res, next) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.user = jwt.verify(h.slice(7), JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// === Login ===
app.post('/api/login', async (req, res) => {
  const { code, pass } = req.body;
  if (!code || !pass) return res.status(400).json({ error: 'code and pass required' });
  try {
    const { headers, data } = await readSheet('Users');
    const iC = headers.indexOf('كود الموظف');
    const iP = headers.indexOf('كلمة المرور');
    const iN = headers.indexOf('الاسم');
    const row = data.find(r =>
      String(r[iC]).trim() === code &&
      String(r[iP]).trim() === pass
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

// === FCM tokens ===
const tokens = new Map();
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) return res.status(400).json({ error: 'user and token required' });
  tokens.set(token, user);
  res.json({ success: true });
});

// === Google Sheets helpers ===
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

// === Protected API ===
app.get('/api/attendance', authenticate, async (req, res) => {
  const { headers, data } = await readSheet('Attendance');
  const idx = headers.indexOf('رقم الموظف');
  const filtered = data.filter(r => String(r[idx]).trim() === req.user.code);
  res.json({ headers, data: filtered });
});
app.get('/api/hwafez', authenticate, async (req, res) => {
  const { headers, data } = await readSheet('hwafez');
  const idx = headers.indexOf('رقم الموظف');
  const filtered = data.filter(r => String(r[idx]).trim() === req.user.code);
  res.json({ headers, data: filtered });
});

// === Notify (Supervisor only) ===
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) return res.status(403).json({ error: 'Forbidden' });
  const { title, body } = req.body;
  const list = Array.from(tokens.keys());
  const resp = await admin.messaging().sendToDevice(list, {
    notification: { title, body }
  });
  const sent = resp.results.filter(r => !r.error).length;
  res.json({ success: true, sent });
});

// === SPA fallback & Start ===
app.get(/.*/, (_, r) => r.sendFile(path.join(__dirname, 'public', 'index.html')));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ listening on ${PORT}`));
