const crypto = require("crypto");
const fs = require("fs");

const algorithm = "aes-256-cbc";
const key = Buffer.from(process.env.ENV_SECRET_KEY, 'base64');

const encrypted = JSON.parse(fs.readFileSync(".env.enc", "utf8"));
const iv = Buffer.from(encrypted.iv, "base64");
const encryptedText = encrypted.data;

const decipher = crypto.createDecipheriv(algorithm, key, iv);
let decrypted = decipher.update(encryptedText, "base64", "utf8");
decrypted += decipher.final("utf8");

fs.writeFileSync(".env", decrypted);
console.log("✅ تم فك التشفير وكتابة .env");
