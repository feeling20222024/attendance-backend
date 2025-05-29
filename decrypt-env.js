const crypto = require('crypto');
const fs = require('fs');

// قراءة ملف env المشفر
const encrypted = fs.readFileSync('.env.enc');

// استخدام المفتاح من متغير بيئة ENV_SECRET_KEY
if (!process.env.ENV_SECRET_KEY) {
  console.error('❌ ENV_SECRET_KEY غير موجود في متغيرات البيئة.');
  process.exit(1);
}

const key = Buffer.from(process.env.ENV_SECRET_KEY, 'base64');

// فصل IV عن باقي البيانات
const iv = encrypted.slice(0, 16);
const data = encrypted.slice(16);

// إنشاء الكائن لفك التشفير
const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

let decrypted;
try {
  decrypted = Buffer.concat([
    decipher.update(data),
    decipher.final()
  ]);
} catch (err) {
  console.error('❌ فشل فك التشفير: تأكد من صحة المفتاح.');
  process.exit(1);
}

// كتابة ملف .env المفكوك
fs.writeFileSync('.env', decrypted);
console.log('✅ تم فك التشفير وكتابة .env');

