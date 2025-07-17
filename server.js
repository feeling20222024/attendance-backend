// server.js

require('dotenv').config();
const express       = require('express');
const cors          = require('cors');
const path          = require('path');
const { MongoClient } = require('mongodb');

// 1) إعداد اتصال MongoDB
const MONGODB_URI   = process.env.MONGODB_URI   || 'mongodb://localhost:27017';
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

const app = express();

// 2) تفعيل CORS
app.use(cors({
  origin: [
    'https://dwam-app-by-omar.netlify.app',
    'http://localhost:3000'
  ],
  methods: ['GET','POST','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));

// 3) وسطاء JSON و static
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 4) Routes الإشعارات

// 4.1) حفظ إشعار جديد
app.post('/api/save-notification', async (req, res) => {
  try {
    const { user, title, body, time } = req.body;
    if (!user || !title || !body || !time) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    await db.collection('notifications').insertOne({ user, title, body, time });
    res.json({ success: true });
  } catch (err) {
    console.error('❌ save-notification error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 4.2) جلب إشعارات المستخدم (آخر 50)
app.get('/api/notifications/:user', async (req, res) => {
  try {
    const user = req.params.user;
    const docs = await db.collection('notifications')
                         .find({ user })
                         .sort({ time: -1 })
                         .limit(50)
                         .toArray();
    res.json(docs);
  } catch (err) {
    console.error('❌ notifications fetch error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// 5) بقية الــ API (login, attendance, hwafez, tqeem) هنا…

// 6) SPA fallback
app.get(/.*/, (_, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

// 7) بدء الخادم
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
