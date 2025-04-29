// server.js

// 1) تحميل متغيّرات البيئة من .env
require('dotenv').config();

const express = require('express');
const multer  = require('multer');
const XLSX    = require('xlsx');
const jwt     = require('jsonwebtoken');
const cors    = require('cors');
const fs      = require('fs');
const path    = require('path');

// 2) قراءة الإعدادات من .env
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_CODE = process.env.ADMIN_CODE || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'password';

if (!JWT_SECRET) {
  console.error('🚨 JWT_SECRET غير موجود في .env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

// 3) خدمة الملفات الثابتة من مجلّد public/
app.use(express.static(path.join(__dirname, 'public')));

// 4) إعداد Multer لرفع ملف Excel
const upload = multer({ dest: path.join(__dirname, 'uploads') });

// 5) مخازن البيانات في الذاكرة
let usersHeaders      = [], usersData      = [];
let attendanceHeaders = [], attendanceData = [];

// 6) Middleware للتحقق من JWT
function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/, '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error();
    next();
  } catch {
    res.status(403).json({ error: 'Invalid token' });
  }
}

// 7) API: تسجيل دخول المشرف
app.post('/api/admin/login', (req, res) => {
  const { code, password } = req.body;
  if (code === ADMIN_CODE && password === ADMIN_PASS) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Invalid admin credentials' });
});

// 8) API: رفع وقراءة ملف Excel
app.post('/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const wb    = XLSX.readFile(req.file.path);
    const shUsr = wb.Sheets['Users'];
    const shAtt = wb.Sheets['Attendance'];
    if (!shUsr || !shAtt) throw new Error('Missing sheets "Users" or "Attendance"');

    // قراءة Users
    const jdUsr = XLSX.utils.sheet_to_json(shUsr, { header: 1 });
    usersHeaders = jdUsr[0].map(h => String(h).trim());
    usersData    = jdUsr.slice(1);

    // قراءة Attendance
    const jdAtt = XLSX.utils.sheet_to_json(shAtt, { header: 1 });
    attendanceHeaders = jdAtt[0].map(h => String(h).trim());
    attendanceData    = jdAtt.slice(1);

    fs.unlinkSync(req.file.path);
    res.json({ message: 'File parsed successfully' });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    res.status(400).json({ error: err.message });
  }
});

// 9) API: جلب بيانات Users
app.get('/api/users', auth, (req, res) => {
  res.json({ headers: usersHeaders, data: usersData });
});

// 10) API: جلب بيانات Attendance
app.get('/api/attendance', auth, (req, res) => {
  res.json({ headers: attendanceHeaders, data: attendanceData });
});

// 11) أي طلب GET آخر → fallback عبر RegExp (يتجنّب path-to-regexp)
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 12) تشغيل الخادم
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
