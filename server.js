require('dotenv').config();             // ← لا يقرأ PORT هنا من .env
const express = require('express');
const cors    = require('cors');
const path    = require('path');
const jwt     = require('jsonwebtoken');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const admin   = require('firebase-admin');

// === Firebase Admin ===
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

// === Express setup ===
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// === Config from Render ENV only ===
const JWT_SECRET      = process.env.JWT_SECRET;
const SUPERVISOR_CODE = process.env.SUPERVISOR_CODE;
const SHEET_ID        = process.env.GOOGLE_SHEET_ID;
const sheetCreds      = JSON.parse(process.env.GOOGLE_SERVICE_KEY);

// … بقية الكود كما سبق
