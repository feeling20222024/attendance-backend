require('dotenv').config();
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const path = require('path');
const app = express();
const PORT = process.env.PORT||3000;
const SHEET_ID = process.env.GOOGLE_SHEET_ID;
if (!SHEET_ID || !process.env.GOOGLE_SERVICE_KEY) {
  console.error('مفقود GOOGLE_SHEET_ID أو GOOGLE_SERVICE_KEY'); process.exit(1);
}
const creds = JSON.parse(process.env.GOOGLE_SERVICE_KEY);

async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({ client_email: creds.client_email, private_key: creds.private_key.replace(/\\n/g,'\n') });
  await doc.loadInfo(); return doc;
}
async function readSheet(title) {
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle[title]; if (!sheet) throw Error(`الشيت "${title}" غير موجود`);
  await sheet.loadHeaderRow();
  const headers = sheet.headerValues;
  const rows = await sheet.getRows();
  const data = rows.map(r=>headers.map(h=>r[h]||''));
  return { headers, data };
}

app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));

app.get('/api/users', async (_,res) => {
  try { res.json(await readSheet('Users')); }
  catch(e){ res.status(400).json({error:e.message}); }
});
app.get('/api/attendance', async (_,res) => {
  try { res.json(await readSheet('Attendance')); }
  catch(e){ res.status(400).json({error:e.message}); }
});
app.get('/api/managers', async (_,res) => {
  try { res.json(await readSheet('Managers')); }
  catch(e){ res.status(400).json({error:e.message}); }
});
app.get('/api/hwafez', async (_,res) => {
  try { res.json(await readSheet('hwafez')); }
  catch(e){ res.status(400).json({error:e.message}); }
});

// SPA fallback
app.get('*',(_,res)=>res.sendFile(path.join(__dirname,'www','index.html')));
app.listen(PORT,()=>console.log(`Server on http://localhost:${PORT}`));
