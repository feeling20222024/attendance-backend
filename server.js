// server.js

// 1) تحميل متغيّرات البيئة
require('dotenv').config();
const express               = require('express');
const cors                  = require('cors');
const path                  = require('path');
const jwt                   = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin                 = require('firebase-admin');
const { MongoClient }       = require('mongodb');

// 2) دالة لتحويل الأرقام العربية/الفارسية إلى لاتينية
function normalizeDigits(str) {
  if (!str) return str;
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    return ch;
  });
}

// 3) تهيئة Firebase Admin
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT غير صالح.');
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// 4) دالة لإرسال إشعار FCM
async function sendPushTo(token, title, body, data = {}) {
  const message = {
    token,
    notification: { title, body },
    android: {
      priority: 'high',
      notification: { channel_id: 'default', sound: 'default' }
    },
    data
  };
  return admin.messaging().send(message);
}

// ———————————————————————————————————————————————————————————
// 5) تهيئة MongoDB
const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ MONGO_URI غير محدد.');
  process.exit(1);
}
let db;
(async () => {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  db = client.db();
  console.log('✅ Connected to MongoDB');
})();

// 6) إعداد Express
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

// (… هنا تكوّن باقي endpoints الخاصة بالحضور والحوافز …)

// 15) تخزين توكنات FCM مؤقتًا
const tokens = new Set();
app.post('/api/register-token', (req, res) => {
  const { user, token } = req.body;
  if (!user || !token) {
    return res.status(400).json({ error: 'user and token required' });
  }
  tokens.add(token);
  res.json({ success: true });
});

// 16) إشعار جميع الأجهزة (للمشرف فقط)
app.post('/api/notify-all', authenticate, async (req, res) => {
  if (req.user.code !== SUPERVISOR_CODE) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { title, body } = req.body;
  await Promise.allSettled(
    Array.from(tokens).map(t => sendPushTo(t, title, body))
  );
  res.json({ success: true });
});

// 17) حفظ إشعار جديد في MongoDB
app.post('/api/save-notification', async (req, res) => {
  const { user, title, body, time } = req.body;
  if (!user || !title || !body || !time) {
    return res.status(400).json({ error: 'Missing fields' });
  }
  try {
    await db.collection('notifications').insertOne({ user, title, body, time });
    res.json({ success: true });
  } catch (e) {
    console.error('❌ save-notification error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 18) جلب آخر 50 إشعارًا لمستخدم معين
app.get('/api/notifications/:user', async (req, res) => {
  const user = req.params.user;
  try {
    const notifs = await db
      .collection('notifications')
      .find({ user })
      .sort({ time: -1 })
      .limit(50)
      .toArray();
    res.json(notifs);
  } catch (e) {
    console.error('❌ get-notifications error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 19) SPA fallback
app.get(/.*/, (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// 20) بدء الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server listening on ${PORT}`));

// ———————————————————————————————————————————————————————————
// وظّف هنا ميدلوير `authenticate` لتحقّق JWT وصلاحيات المستخدم
// …  
