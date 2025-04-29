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

//
// 2) إعداد المتغيّرات من .env
//
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('🚨 JWT_SECRET غير موجود في .env');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());

//
// 3) نقطة النهاية الافتراضية للتأكد من عمل الخادم
//
app.get('/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

//
// 4) إعداد Multer لتخزين الملفات مؤقتاً
//
const upload = multer({ dest: 'uploads/' });

//
// 5) مخازن البيانات في الذاكرة
//
let attendanceData = [], usersData = [];
let headersAtt = [], headersUsr = [];

//
// 6) نقطة تسجيل دخول المشرف وإصدار JWT
//
app.post('/api/admin/login', (req, res) => {
  const { code, password } = req.body;
  // هنا ضع بيانات المشرف الحقيقية
  if (code === 'ADMIN' && password === 'admin123') {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1h' });
    return res.json({ token });
  }
  res.status(401).json({ error: 'Unauthorized' });
});

//
// 7) ميدلوير للتحقق من JWT في الهيدر Authorization
//
function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token      = authHeader.replace(/^Bearer\s+/, '');
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') throw new Error();
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

//
// 8) رفع ملف Excel وقراءته
//
app.post('/api/upload', auth, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  const filePath = path.resolve(req.file.path);
  try {
    const workbook = XLSX.readFile(filePath);
    const shAtt    = workbook.Sheets['Attendance'];
    const shUsr    = workbook.Sheets['Users'];
    if (!shAtt || !shUsr) {
      throw new Error('Missing sheets "Attendance" or "Users"');
    }

    const jdAtt = XLSX.utils.sheet_to_json(shAtt, { header: 1 });
    const jdUsr = XLSX.utils.sheet_to_json(shUsr, { header: 1 });

    headersAtt     = jdAtt[0].map(h => String(h).trim());
    headersUsr     = jdUsr[0].map(h => String(h).trim());
    attendanceData = jdAtt.slice(1);
    usersData      = jdUsr.slice(1);

    // احذف الملف المؤقت
    fs.unlinkSync(filePath);

    res.json({ message: 'File uploaded and parsed successfully' });
  } catch (err) {
    // حدف الملف إذا حصل خطأ
    fs.unlink(filePath, () => {});
    res.status(400).json({ error: err.message });
  }
});

//
// 9) جلب بيانات Users
//
app.get('/api/users', auth, (req, res) => {
  res.json({ headers: headersUsr, data: usersData });
});

//
// 10) جلب بيانات Attendance
//
app.get('/api/attendance', auth, (req, res) => {
  res.json({ headers: headersAtt, data: attendanceData });
});

//
// 11) بدء تشغيل الخادم
//
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});
