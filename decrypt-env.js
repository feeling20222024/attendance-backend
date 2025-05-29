// decrypt-env.js
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// 1) تأكّد من وجود متغيّر المفتاح
if (!process.env.ENV_SECRET_KEY) {
  console.error('❌ ENV_SECRET_KEY غير معرّف في متغيّرات البيئة');
  process.exit(1);
}

// 2) جهّز المفتاح من base64 إلى Buffer
let key;
try {
  key = Buffer.from(process.env.ENV_SECRET_KEY, 'base64');
  if (key.length !== 32) {
    throw new Error(`طول المفتاح غير صحيح (${key.length} بايت، مطلوب 32 بايت)`);
  }
} catch (e) {
  console.error('❌ خطأ في قراءة ENV_SECRET_KEY:', e.message);
  process.exit(1);
}

// 3) اقرأ الملف المشفّر (.env.enc)
const encPath = path.join(__dirname, '.env.enc');
if (!fs.existsSync(encPath)) {
  console.error('❌ لم أجد الملف .env.enc في جذر المشروع');
  process.exit(1);
}

let encryptedJson;
try {
  encryptedJson = JSON.parse(fs.readFileSync(encPath, 'utf8'));
  if (!encryptedJson.iv || !encryptedJson.data) {
    throw new Error('الملف المشفّر لا يحتوي على iv و data');
  }
} catch (e) {
  console.error('❌ خطأ في قراءة أو تحليل .env.enc:', e.message);
  process.exit(1);
}

// 4) فكّّ التشفير
try {
  const iv            = Buffer.from(encryptedJson.iv, 'base64');
  const encryptedData = Buffer.from(encryptedJson.data, 'base64');

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedData, null, 'utf8');
  decrypted    += decipher.final('utf8');

  // 5) اكتب الناتج إلى .env
  const outPath = path.join(__dirname, '.env');
  fs.writeFileSync(outPath, decrypted, 'utf8');
  console.log('✅ تم فكّ التشفير وكتابة الملف .env');
} catch (e) {
  console.error('❌ فشل فك التشفير:', e.message);
  process.exit(1);
}
