// 1) تحميل متغيّرات البيئة من .env
require('dotenv').config();
const fs               = require('fs');
const express          = require('express');             // ← هنا
const cors             = require('cors');
const path             = require('path');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin            = require('firebase-admin');

const serviceAccount = {
  type:                        "service_account",
  project_id:                  "device-streaming-47cbe934",
  private_key_id:              "b6930fb1363b13912cfab0694017486391e0e7cc",
  private_key:                 "-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCZw/n9MWFgrH5N\n9O5Ru95Xs5D55KIeFmOD4xogK+pgHANEFzpUrQ8cDOl9yfXPxv+pa83DKwSurkux\nUResCBOUTez2Od5WbrcHiQkvZklAfPi+5XiH5hx0JjvZ7g4SmGrN248nWwQZ8WF5\nWF+6KcGUOwKq++ijvJhKBdUyS6mwnG5XADs5nidxqNJGKGSacpHirOPeOO9GRjL4\nNmXi25vHh1c1tPL7sYmuF2Ub7Ak4g0kqOSJUqhs5d8RmFvOr9kjaTr2vPGfFMdAl\n5UERxgrX/6J4JasuPR6EmbWc1h/TquT2UHnf4jPop9oOKQxoFbibakR3Z5AaN0MS\ndGnDN88DAgMBAAECggEAF2T0vOvtZ9r2oH+6Xp8Ztfgw/4QkkjVP0LoVuH1V/Gdm\nq85o5ocp/FeOkr/OcV1SeoFXXfFGlhkYlRLEaj0UVYUBn3iwdjAEEtZrmlWSoYgi\nBFE/ZFXDUHycsIyCgZvE7CsSfadgWV4bOW4Tqmw98oKD5mXLQFYqSWDXzf4rBB6c\nX5Uv/Vs5+3TC5SrGMosJ5CD5VJYptQGxchzT+bbBLAf8gU0Hlldge24y4m6YShPF\nZUXCh5H6NWoOr/cH7ywaw3zJai+3UE379PuiuinVULUtsQsYGIgImE15FBcvKmGh\nrq4yhBTkNlOgsYjk4ullSAZsR6GjfrlrmkqOlM54mQKBgQDHN2TM3IqV5vHr1TlB\ntzbHbwg9Gf4ch5ab6XL8MSoXQKexNm3w1sOxZ2ihc09iolyQ0uxg5SV+qebV+YhW\nw0HVb4KP9Cv8bReh6lqh2jQD3ABpSgydKuaWhwJfE+EopKNxQvwMomCWXuoMGbEg\nQO86b7GVd7uGA6zkB5s1ZmtFfQKBgQDFmBU94FGW3VdoaDaax3kxZul/n8+MPQuY\ngBvpE6yQwN4/jHkgtoejrJEt4iLVJIpMlY5vmkdVErRVdH9qjmGTSia1kzA3lXt0\nUx8Ah0Z0f2ltpyiO/EYy8rqoAuDN9jDqIPZ6lXTfkTDtohBkasUHFPStTYTh8xYV\nUBAMZ1mOfwKBgQDEoSo/AhdPqelyqrye3mWVJ0RserFUG4hOT3eM8EHpPYnG4kBV\njMUO31BoutXKNxNCZs2lPcdqY+xRmsA1Uvgx4KRvzcN0nYDL8fKO+j6I6KcHRW15\n25RJUuzGR2rfoNEpw8Hf/o1zHi/IzbsEaNM3THNtYgaXWh1V3SQW6wZKSQKBgQC3\ndz2J5WV8Uepd3B2PW1VRJH/76zP3v5qrr4+6u3TINvxlPxYc5L5On+VxF/5Fr5bm\nAxtsznAbMrHUgsXn92nsK7aDc7YadiZZ3O/1OqWVd9Q5ZzMGiIDZv3zGkV2Qf13t\nlkuliG4rQ5GNo6PayTRGHhQNcePHNEE16s/r5G5IGwKBgQC2xsx8Ni37fmEbIGR9\nsyOY2U2EBwZJEUBKCTKd+0CbAW/ga3iHSPfJbhdLiMDHi4vD+BMNvNG00tq06fzc\np5Pse+s9+9aEVRzedkVwsQMksig0wyGJm+NRz6JP3Cf96jNA+PKZql7CBpotgNgB\nFs2Z9mcJTHnkDmBq+2UhZtIFww==\n-----END PRIVATE KEY-----\n",
  client_email:                "firebase-adminsdk-fbsvc@device-streaming-47cbe934.iam.gserviceaccount.com",
  client_id:                   "112141515526708786079",
  auth_uri:                    "https://accounts.google.com/o/oauth2/auth",
  token_uri:                   "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:        "https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40device-streaming-47cbe934.iam.gserviceaccount.com",
  universe_domain:             "googleapis.com"
};
// 2) تهيئة Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 3) تهيئة Express
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 4) مصفوفة مؤقتة لتخزين التوكنات (يمكن استبدالها بقاعدة بيانات)
const tokens = new Map();

// 5) مسار تسجيل التوكن من العميل
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) {
    return res.status(400).json({ error: 'مفقود user أو token' });
  }
  tokens.set(token, user);
  console.log(`🔔 سجّل التوكن للمستخدم ${user}:`, token);
  res.json({ success: true });
});

// 6) إعداد Google Sheets
const PORT     = process.env.PORT || 3000;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
if (!SHEET_ID || !process.env.GOOGLE_SERVICE_KEY) {
  console.error('🚨 missing GOOGLE_SHEET_ID or GOOGLE_SERVICE_KEY');
  process.exit(1);
}
let creds;
try {
  creds = JSON.parse(process.env.GOOGLE_SERVICE_KEY);
} catch {
  console.error('🚨 invalid GOOGLE_SERVICE_KEY JSON');
  process.exit(1);
}

async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: creds.client_email,
    private_key: creds.private_key.replace(/\\n/g, '\n'),
  });
  await doc.loadInfo();
  return doc;
}
async function readSheet(title) {
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) throw new Error(`Sheet "${title}" not found`);
  await sheet.loadHeaderRow();
  const headers = sheet.headerValues;
  const rows    = await sheet.getRows();
  const data    = rows.map(r => headers.map(h => r[h] ?? ''));
  return { headers, data };
}

// 7) مسارات API للقراءة
app.get('/api/users',    async (req, res) => { try { res.json(await readSheet('Users')); }    catch (e) { res.status(400).json({ error: e.message }); } });
app.get('/api/attendance',async (req, res) => { try { res.json(await readSheet('Attendance')); }catch (e) { res.status(400).json({ error: e.message }); } });
app.get('/api/hwafez',   async (req, res) => { try { res.json(await readSheet('hwafez')); }   catch (e) { res.status(400).json({ error: e.message }); } });

// 8) مسار إرسال الإشعار للمشرف (فقط عبر FCM)
app.post('/api/notify-all', async (req, res) => {
  const { title, body } = req.body;
  const message = {
    notification: { title, body },
    tokens:       Array.from(tokens.keys())
  };
  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log('FCM multicast result:', response);
    res.json({ success: true, sent: response.successCount });
  } catch (err) {
    console.error('FCM error:', err);
    res.status(500).json({ error: err.message });
  }
});

// 9) SPA fallback
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 10) تشغيل الخادم
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  accessSheet()
    .then(() => console.log('✅ Connected to Google Sheets'))
    .catch(err => console.error('🚨 Sheet access error:', err.message));
});
