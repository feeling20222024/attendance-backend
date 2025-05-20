// server.js

require('dotenv').config();
const express = require('express');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const path = require('path');

const PORT       = process.env.PORT || 3000;
const SHEET_ID   = process.env.GOOGLE_SHEET_ID;
const SERVICE_KEY= process.env.GOOGLE_SERVICE_KEY;

if (!SHEET_ID || !SERVICE_KEY) {
  console.error('🚨 Missing .env vars');
  process.exit(1);
}

const creds = JSON.parse(SERVICE_KEY);

async function accessSheet() {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: creds.client_email,
    private_key: creds.private_key.replace(/\\n/g, '\n'),
  });
  await doc.loadInfo();
  return doc;
}

async function readSheet(title) {
  const doc = await accessSheet();
  const sheet = doc.sheetsByTitle[title];
  if (!sheet) throw new Error(`Sheet "${title}" not found`);
  await sheet.loadHeaderRow();
  const rows = await sheet.getRows();
  const data = rows.map(r => sheet.headerValues.map(h => r[h] || ''));
  return {
    headers: sheet.headerValues,
    data
  };
}

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/users',     async (req, res) => { try { res.json(await readSheet('Users'));       } catch (e) { res.status(400).json({error:e.message}); } });
app.get('/api/attendance',async (req, res) => { try { res.json(await readSheet('Attendance')); } catch (e) { res.status(400).json({error:e.message}); } });
app.get('/api/hwafez',    async (req, res) => { try { res.json(await readSheet('hwafez'));     } catch (e) { res.status(400).json({error:e.message}); } });
app.get('/api/managers',  async (req, res) => { try { res.json(await readSheet('Managers'));   } catch (e) { res.status(400).json({error:e.message}); } });

app.get(/.*/, (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html'))
);

app.listen(PORT, () =>
  console.log(`Server running on http://localhost:${PORT}`)
);
