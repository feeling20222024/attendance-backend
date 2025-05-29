const crypto = require("crypto");
const fs = require("fs");

const key = Buffer.from(process.env.ENV_SECRET_KEY, "base64");
const iv = fs.readFileSync(".env.enc", { encoding: "utf8" }).slice(0, 16); // assuming IV is first 16 bytes
const encryptedData = Buffer.from(fs.readFileSync(".env.enc", { encoding: "utf8" }).slice(16), "base64");

try {
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let decrypted = decipher.update(encryptedData, null, "utf8");
  decrypted += decipher.final();
  fs.writeFileSync(".env", decrypted);
  console.log("✅ تم فك التشفير وكتابة .env");
} catch (error) {
  console.error("❌ فشل فك التشفير: تأكد من صحة المفتاح.");
  process.exit(1);
}
