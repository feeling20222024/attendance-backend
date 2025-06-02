// server.js

require('dotenv').config();
const express               = require('express');
const cors                  = require('cors');
const path                  = require('path');
const jwt                   = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin                 = require('firebase-admin');

// ........................................
// تهيئة Firebase Admin (كما في كودك سابقًا)
// ........................................
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

// ........................................
// تهيئة Express وقراءة المتغيرات
// ........................................
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

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

// ........................................
// تابع كتابة بقية الـ CRUD على جوجل شيت و
// مسارات /api/login، /api/me، /api/attendance، /api/hwafez
// كما لديك بالفعل في كودك النهائي سابقاً.
// ........................................

// مثال على استقبال توكن FCM:
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

// مثال إرسال الإشعار:
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { title, body } = req.body;
  const list = Array.from(tokens.keys());
  if (list.length === 0) {
    return res.json({ success: true, sent: 0 });
  }
  const message = {
    notification: { title, body },
    tokens: list
  };
  try {
    const response = await admin.messaging().sendMulticast(message);
    console.log(`✅ أُرسل إشعار إلى ${response.successCount} جهاز، فشل ${response.failureCount}`);
    return res.json({ success: true, sent: response.successCount });
  } catch (err) {
    console.error('FCM error:', err);
    return res.status(500).json({ error: err.message });
  }
});

// الباقي: /api/login, /api/me, /api/attendance, /api/hwafez, fallback إلى index.html
app.get(/.*/, (_, r) =>
  r.sendFile(path.join(__dirname, 'public', 'index.html'))
);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server listening on port ${PORT}`));
