// public/js/push.js

// —————————————————————————————————————————
//  إعدادات Firebase — استخدم مفاتيحك هنا
// —————————————————————————————————————————
var firebaseConfig = {
  apiKey: "AIzaSyClFXniBltSeJrp3sxS3_bAgbrZPo0vP3Y",
  authDomain: "device-streaming-47cbe934.firebaseapp.com",
  projectId: "device-streaming-47cbe934",
  storageBucket: "device-streaming-47cbe934.appspot.com",
  messagingSenderId: "235398312189",
  appId: "1:235398312189:web:8febe5e63f7b134b808e94"
};
var VAPID_PUBLIC_KEY = "BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f18go2a6oWWw0VrMBYPLSxco2-44GyDVH0U5BHn7ktiQ";

function initPush() {
  // 1) احصل على التسجيل الحالي للـ Service Worker
  navigator.serviceWorker.getRegistration().then(function(swReg) {
    if (!swReg) {
      console.warn('⚠️ Service Worker غير مسجّل بعد');
      return;
    }

    // 2) ابدأ تطبيق Firebase
    firebase.initializeApp(firebaseConfig);
    var messaging = firebase.messaging();

    // 3) اطلب إذن الإشعارات
    Notification.requestPermission().then(function(permission) {
      if (permission !== 'granted') {
        console.warn('❌ المستخدم لم يمنح إذن الإشعارات');
        return;
      }

      // 4) احصل على الـ FCM token مع VAPID و Service Worker
      messaging.getToken({
        vapidKey: VAPID_PUBLIC_KEY,
        serviceWorkerRegistration: swReg
      }).then(function(token) {
        if (!token) {
          console.warn('❌ لم يتم الحصول على FCM token');
          return;
        }
        console.log('✅ FCM token:', token);

        // 5) تأكد أن currentUser معرف
        var user = window.currentUser || localStorage.getItem('currentUser');
        if (!user) {
          console.warn('⚠️ currentUser غير مسجّل');
          return;
        }

        // 6) أرسل التوكن إلى الخادم
        fetch('https://dwam-app-by-omar.onrender.com/api/register-token', {
          method: 'POST',
          headers: { 'Content-Type':'application/json' },
          body: JSON.stringify({ user: user, token: token })
        })
        .then(function(res) {
          if (!res.ok) throw new Error(res.statusText);
          console.log('✅ تم تسجيل توكن FCM بنجاح على الخادم');
        })
        .catch(function(err) {
          console.error('❌ خطأ في تسجيل التوكن على الخادم:', err);
        });

        // 7) استمع للرسائل عند الواجهة (foreground)
        messaging.onMessage(function(payload) {
          console.log('📩 foreground:', payload);
          var notif = payload.notification || {};
          if (notif.title) {
            new Notification(notif.title, { body: notif.body });
          }
        });

      }).catch(function(err) {
        console.error('❌ getToken error:', err);
      });
    });
  }).catch(function(err) {
    console.error('❌ getRegistration error:', err);
  });
}

// اجعل الدالة متاحة عالميًّا
window.initPush = initPush;
