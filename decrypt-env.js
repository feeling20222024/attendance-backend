// decrypt-env.js
const fs     = require('fs');
const crypto = require('crypto');

// المفتاح يُخزَّن كـ BASE64 في متغير بيئة Render ENV_SECRET_KEY
const key = Buffer.from(process.env.ENV_SECRET_KEY, 'base64');
const { iv, data } = JSON.parse(fs.readFileSync('.env.secret.enc', 'utf8'));

const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'base64'));
let decrypted = decipher.update(Buffer.from(data, 'base64'));
decrypted     = Buffer.concat([decrypted, decipher.final()]);

// اكتب المتغيّرات المفكَّكة في ملف منفصل
fs.writeFileSync('.env.secret', decrypted);
console.log('✅ secrets written to .env.secret');
