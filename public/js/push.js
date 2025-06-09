// public/js/push.js

const firebaseConfig = { /* مفاتيحك هنا */ };
const VAPID_PUBLIC_KEY = 'BIvZq29UIB5CgKiIXUOCVVVDX0DtyKuixDyXm6WpCc1f...';

async function initPush() {
  try {
    // 1) سجّل SW الخاص بالإشعارات
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
    console.log('✅ Firebase SW registered:', swReg.scope);

    // 2) ابدأ Firebase واطلب التوكن
    firebase.initializeApp(firebaseConfig);
    const messaging = firebase.messaging();

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('❌ المستخدم لم يمنح إذن الإشعارات');
      return;
    }

    const token = await messaging.getToken({
      vapidKey: VAPID_PUBLIC_KEY,
      serviceWorkerRegistration: swReg
    });
    console.log('✅ FCM token:', token);

    // 3) أرسل التوكن إلى الخادم
    const user = window.currentUser || localStorage.getItem('currentUser');
    if (!user) {
      console.warn('⚠️ currentUser غير مسجّل');
      return;
    }
    await fetch('https://dwam-app-by-omar.onrender.com/api/register-token', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ user, token })
    });
    console.log('✅ تم تسجيل توكن FCM بنجاح على الخادم');

    // 4) استمع للإشعارات أثناء الواجهة
    messaging.onMessage(payload => {
      console.log('📩 foreground message:', payload);
      const { title, body } = payload.notification || {};
      if (title) new Notification(title, { body });
    });

  } catch (err) {
    console.error('❌ initPush error:', err);
  }
}
window.initPush = initPush;
