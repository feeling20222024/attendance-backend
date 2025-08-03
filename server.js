// server.js

// 1) تحميل متغيّرات البيئة
require('dotenv').config();

const express              = require('express');
const cors                 = require('cors');
const path                 = require('path');
const jwt                  = require('jsonwebtoken');
const { GoogleSpreadsheet} = require('google-spreadsheet');
const admin                = require('firebase-admin');

// 2) تهيئة Express و CORS
const app = express();
const corsOptions = {
  origin: ['https://dwam-app-by-omar.netlify.app'], // أضف أي دومينات أخرى حسب الحاجة
  methods: ['GET','POST','DELETE'],
  allowedHeaders: ['Content-Type','Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 3) إعدادات عامة
const APP_VERSION = process.env.APP_VERSION || '1.0.7';
const PORT        = process.env.PORT        || 3000;

// 4) دالة لتطبيع الأرقام العربية/الفارسية
function normalizeDigits(str) {
  if (!str) return '';
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const code = ch.charCodeAt(0);
    if (code >= 0x0660 && code <= 0x0669) return String(code - 0x0660);
    if (code >= 0x06F0 && code <= 0x06F9) return String(code - 0x06F0);
    return ch;
  });
}

// 5) تهيئة Firebase Admin
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT غير صالح.');
  process.exit(1);
}
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// 6) دالة إرسال إشعار FCM
async function sendPushTo(token, title, body, data = {}) {
  const message = {
    token,
    notification: { title, body },
    android: {
      ttl: 48 * 60 * 60 * 1000, // 48h بالميلي ثانية
      priority: 'high'
    },
    data
  };
  try {
    await admin.messaging().send(message);
  } catch (err) {
    console.error(`❌ فشل الإرسال إلى ${token}:`, err);
  }
}

// 7) قراءة متغيّرات البيئة الأساسية
const {
  JWT_SECRET,
  SUPERVISOR_CODE,
  GOOGLE_SHEET_ID: SHEET_ID,
  GOOGLE_SERVICE_KEY
} = process.env;
if (!JWT_SECRET || !SUPERVISOR_CODE || !SHEET_ID || !GOOGLE_SERVICE_KEY) {
  console.error('❌ بعض متغيرات البيئة مفقودة.');
  process.exit(1);
}
let sheetCreds;
try {
  sheetCreds = JSON.parse(GOOGLE_SERVICE_KEY);
} catch {
  console.error('❌ GOOGLE_SERVICE_KEY ليس JSON صالح.');
  process.exit(1);
}

// 8) دوال الوصول إلى Google Sheets
async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: sheetCreds.client_email,
    private_key:  sheetCreds.private_key.replace(/\\n/g,'\n')
  });
  await doc.loadInfo();
  return doc;
}
async function readSheet(title) {
  const doc   = await accessSheet();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) throw new Error(`Sheet "${title}" غير موجود`);
  await sheet.loadHeaderRow();
  const headers = sheet.headerValues;
  const rows    = await sheet.getRows();
  const data    = rows.map(r => headers.map(h => r[h]||''));
  return { headers, data };
}

// 9) JWT Middleware
function authenticate(req, res, next
