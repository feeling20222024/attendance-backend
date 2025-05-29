const fs = require('fs');
const crypto = require('crypto');

// تحميل المفتاح من متغير البيئة
const key = Buffer.from(process.env.ENV_SECRET_KEY, 'base64');

// تحميل محتوى الملف المشفر بصيغة JSON
const encryptedJson = JSON.parse(fs.readFileSync('.env.enc', 'utf8'));
const iv = Buffer.from(encryptedJson.iv, 'base64');
const encryptedData = Buffer.from(encryptedJson.data, 'base64');

// فك التشفير
try {
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encryptedData, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  // كتابة الملف الناتج
  fs.writeFileSync('.env', decrypted);
  console.log('✅ تم فك التشفير وكتابة .env');
} catch (error) {
  console.error('❌ فشل فك التشفير:', error.message);
  process.exit(1);
}
