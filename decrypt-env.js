// decrypt-env.js
require('dotenv').config(); // لا يهم أن يحمل متغيرات Render
const fs     = require('fs');
const crypto = require('crypto');

// المفتاح من متغير بيئة Render
const key = Buffer.from(process.env.ENV_SECRET_KEY, 'base64');
const { iv, data } = JSON.parse(fs.readFileSync('.env.secret.enc','utf8'));
const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv,'base64'));
let dec = decipher.update(Buffer.from(data,'base64'));
dec    = Buffer.concat([dec, decipher.final()]);

fs.writeFileSync('.env.secret', dec);
console.log('✅ secrets written to .env.secret');
