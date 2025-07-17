// server.js

// 1) متطلبات
require('dotenv').config();
const express       = require('express');
const cors          = require('cors');
const path          = require('path');
const { MongoClient, ObjectId } = require('mongodb');

// 2) إعداد اتصال MongoDB
const MONGODB_URI   = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = process.env.DATABASE_NAME || 'attendanceApp';
let db;

MongoClient.connect(MONGODB_URI, { useUnifiedTopology: true })
  .then(client => {
    db = client.db(DATABASE_NAME);
    console.log('✅ Connected to MongoDB');
  })
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// 3) إنشاء تطبيق Express
const app = express();

// 4) تفعيل CORS
app.use(cors({
  origin: [
    'https://dwam-app-by-omar.netlify.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// 5) وسطاء JSON و static
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 6) Routes الإشعارات

// 6.1) حفظ إشعار جديد
app.post('/api/save-notification', async (req, res) => {
  try {
    const { user, title, body, time } = req.body;
    if (!user || !title || !body || !time) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const coll = db.collection('notifications');
    await coll.insertOne({ user, title, body, time });
    res.json({ success: true });
  } catch (e) {
    console.error('❌ save-notification error:', e);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 6.2) جلب آخر 50 إشعاراً لمستخدم معيّن
app.get('/api/notifications/:user', async (req, res) => {
  try {
    const user = req.params.user;
    const coll = db.collection('notifications');
    const notifs = await coll
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

// 7) هنا تضيف باقي الـ routes: login, attendance, hwafez, tqeem، …
//    مثال سريع للتوضيح:
// app.post('/api/login', async (req,res) => { /* ... */ });
// app.get('/api/attendance', async (req,res) => { /* ... */ });

// 8) SPA fallback للـ client-side routing
app.get(/.*/, (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// 9) بدء الخادم
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
