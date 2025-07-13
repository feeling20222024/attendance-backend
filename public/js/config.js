// public/js/config.js
// —————————————————————————————————————————
// 1) استيراد Firebase (Compat API) وتهيئة التطبيق
// —————————————————————————————————————————
importScripts?.() // هذا السطر لضمان عمل importScripts في SW إن استُخدم هناك.

import firebase from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js';

const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};

firebase.initializeApp(firebaseConfig);

// نصدر الكائنات المشتركة لاستخدامها في الملفات الأخرى
export const auth      = firebase.auth();
export const firestore = firebase.firestore();
export const messaging = firebase.messaging();

// نقطة النهاية العامة
export const API_BASE = 'https://dwam-app-by-omar.onrender.com/api';
