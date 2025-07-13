// public/js/firebase-config.js
// —————————————————————————————————————————
// 1) استيراد Firebase Compat API كـ ES‑Module
// —————————————————————————————————————————
import firebase from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-app-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore-compat.js';
import 'https://www.gstatic.com/firebasejs/9.22.1/firebase-messaging-compat.js';

// —————————————————————————————————————————
// 2) تكوين التطبيق
// —————————————————————————————————————————
const firebaseConfig = {
  apiKey:           "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain:       "device-streaming-47cbe934.firebaseapp.com",
  projectId:        "device-streaming-47cbe934",
  storageBucket:    "device-streaming-47cbe934.appspot.com",
  messagingSenderId:"235398312189",
  appId:            "1:235398312189:web:8febe5e63f7b134b808e94"
};

// —————————————————————————————————————————
// 3) تهيئة Firebase
// —————————————————————————————————————————
firebase.initializeApp(firebaseConfig);

// ★ يمكنك الآن استيراد هذه المتغيرات في أي ملف آخر ★
export const auth      = firebase.auth();
export const db        = firebase.firestore();
export const messaging = firebase.messaging();
