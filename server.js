require('dotenv').config();
const express              = require('express');
const cors                 = require('cors');
const path                 = require('path');
const jwt                  = require('jsonwebtoken');
const { GoogleSpreadsheet}= require('google-spreadsheet');
const admin                = require('firebase-admin');

const APP_VERSION   = process.env.APP_VERSION || '1.0.7';
const PORT          = process.env.PORT        || 3000;

// تطبيع الأرقام
function normalizeDigits(str) {
  return str.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, ch => {
    const c=ch.charCodeAt(0);
    return c>=0x0660&&c<=0x0669 ? c-0x0660
         : c>=0x06F0&&c<=0x06F9 ? c-0x06F0 : ch;
  });
}

// Firebase Admin
let serviceAccount;
try {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch {
  console.error('❌ FIREBASE_SERVICE_ACCOUNT invalid'); process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

// دالة الإرسال
async function sendPushTo(token, title, body, data={}) {
  const msg = { token, notification:{ title, body }, android:{ ttl:48*3600*1000, priority:'high' }, data };
  try { await admin.messaging().send(msg); }
  catch(e){ console.error('❌ FCM send error', e); }
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname,'public')));

const { JWT_SECRET, SUPERVISOR_CODE, GOOGLE_SHEET_ID, GOOGLE_SERVICE_KEY } = process.env;
if (!JWT_SECRET||!SUPERVISOR_CODE||!GOOGLE_SHEET_ID||!GOOGLE_SERVICE_KEY) {
  console.error('❌ Missing env vars'); process.exit(1);
}
const sheetCreds = JSON.parse(process.env.GOOGLE_SERVICE_KEY);

async function accessSheet(){
  const doc=new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID);
  await doc.useServiceAccountAuth({ client_email:sheetCreds.client_email, private_key:sheetCreds.private_key.replace(/\\n/g,'\n') });
  await doc.loadInfo(); return doc;
}
async function readSheet(title){
  const doc=await accessSheet();
  const sheet=doc.sheetsByTitle[title]; if(!sheet) throw new Error(`Sheet ${title} not found`);
  await sheet.loadHeaderRow();
  const data=(await sheet.getRows()).map(r=>sheet.headerValues.map(h=>r[h]||''));
  return { headers: sheet.headerValues, data };
}

// JWT middleware
function authenticate(req,res,next){
  const h=req.headers.authorization;
  if(!h||!h.startsWith('Bearer '))return res.status(401).end();
  try{ req.user=jwt.verify(h.slice(7),JWT_SECRET); next(); }
  catch{ res.status(401).end(); }
}

// login
app.post('/api/login', async (req,res)=>{
  let {code,pass}=req.body;
  if(!code||!pass) return res.status(400).json({error:'code&pass'});
  code=normalizeDigits(code.trim()); pass=normalizeDigits(pass.trim());
  try{
    const { headers, data } = await readSheet('Users');
    const iC=headers.indexOf('كود الموظف'), iP=headers.indexOf('كلمة المرور'), iN=headers.indexOf('الاسم');
    const row = data.find(r=>normalizeDigits(r[iC].trim())===code && normalizeDigits(r[iP].trim())===pass);
    if(!row) return res.status(401).json({error:'Invalid'});
    const payload={code,name:row[iN]}; const token=jwt.sign(payload,JWT_SECRET,{expiresIn:'12h'});
    res.json({token,user:payload});
  }catch(e){ console.error(e); res.status(500).json({error:'Login failed'}); }
});

// attendance + notes
app.get('/api/attendance', authenticate, async (req,res)=>{
  try{
    const { headers, data } = await readSheet('Attendance');
    const idx=headers.indexOf('رقم الموظف');
    const code=normalizeDigits(req.user.code+'');
    const userRows=data.filter(r=>normalizeDigits(r[idx].trim())===code);
    const colSpec=headers.indexOf('تنبيهات وملاحظات عامة');
    const noteSpec=userRows.find(r=>r[colSpec]?.trim())?.[colSpec].trim()||'';
    const generalRows=data.filter(r=>!r[idx].trim());
    const colAll=headers.indexOf('تنبيهات وملاحظات عامة لجميع العاملين');
    const noteAll=generalRows[0]?.[colAll].trim()||'';
    res.json({headers,data:userRows,noteSpec,noteAll});
  }catch(e){ console.error(e); res.status(500).json({error:e.message}); }
});

// hwafez
app.get('/api/hwafez', authenticate, async (req,res)=>{
  const { headers, data } = await readSheet('hwafez');
  const idx=headers.indexOf('رقم الموظف'), code=normalizeDigits(req.user.code+'');
  res.json({ headers, data: data.filter(r=>normalizeDigits(r[idx].trim())===code) });
});

// tqeem
app.get('/api/tqeem', authenticate, async (req,res)=>{
  const { headers, data } = await readSheet('tqeem');
  const idx=headers.indexOf('رقم الموظف'), code=normalizeDigits(req.user.code+'');
  res.json({ headers, data: data.filter(r=>normalizeDigits(r[idx].trim())===code) });
});

// register-token
const tokens=new Map();
app.post('/api/register-token', authenticate, (req,res)=>{
  const { user, token } = req.body;
  if(!user||!token) return res.status(400).end();
  tokens.set(token,user); res.json({success:true});
});

// notify-all
app.post('/api/notify-all', authenticate, async (req,res)=>{
  if(req.user.code!==SUPERVISOR_CODE) return res.status(403).end();
  const { title, body } = req.body;
  await Promise.allSettled(Array.from(tokens.keys()).map(t=>sendPushTo(t,title,body)));
  res.json({success:true});
});

// unified notifications
const userNotifications={};
app.post('/api/notifications', authenticate, (req,res)=>{
  const { title, body, time } = req.body;
  if(!title||!body||!time) return res.status(400).end();
  const code=req.user.code;
  userNotifications[code]=userNotifications[code]||[];
  userNotifications[code].unshift({title,body,time});
  if(userNotifications[code].length>50) userNotifications[code].pop();
  res.json({success:true});
});
app.get('/api/notifications', authenticate, (req,res)=>{
  res.json({notifications: userNotifications[req.user.code]||[]});
});
// supervisor-only delete
app.delete('/api/notifications', authenticate, (req,res)=>{
  if(req.user.code!==SUPERVISOR_CODE) return res.status(403).end();
  const code=req.user.code;
  userNotifications[code]=[];
  res.json({success:true});
});

// version
app.get('/api/version', (req,res)=>{
  res.json({version: APP_VERSION});
});

// SPA fallback
app.get(/.*/, (_,res)=>res.sendFile(path.join(__dirname,'public','index.html')));

// start
app.listen(PORT, ()=>console.log(`🚀 Server on ${PORT}`));
