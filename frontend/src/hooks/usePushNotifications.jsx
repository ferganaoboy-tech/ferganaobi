import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';

// Public VAPID Key must match backend
const PUBLIC_VAPID_KEY = 'BN85UPCcuQDb0asnDftiuhNoh-NoeM8j3-4pImhzKpgYNzhIXQ3ODlfWYw3jkcysMYFBx6MkqrHmLouxfXU9b84';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Check if device is iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    // Check if running as a PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

    // On iOS, Push is ONLY supported in standalone mode (PWA added to home screen)
    if (isIOS && !isStandalone) {
      setIsSupported(false);
      return;
    }

    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      checkSubscription();
    }
  }, []);

  const checkSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      setIsSubscribed(!!subscription);
      
      // MUKAMMAL SINXRONIZATSIYA: Agar ruxsat berilgan bo'lsa, har safar ilova ochilganda
      // backenddagi bazani ushbu foydalanuvchi/filialga yangilash (foydalanuvchi almashgan bo'lishi mumkin)
      if (subscription && Notification.permission === 'granted') {
        api.post('/push/subscribe', subscription).catch(() => {});
      }
    } catch (e) {
      console.error(e);
    }
  };

  const subscribeToPush = async () => {
    if (!isSupported) {
      toast.error('Brauzerda Push Notification qo\'llab-quvvatlanmaydi.');
      return false;
    }

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);

      if (perm !== 'granted') {
        toast.error(
          <div className="flex flex-col gap-1.5">
            <span className="font-semibold text-[13px]">Xabarnomalarga ruxsat berilmadi</span>
            <span className="text-[12px] opacity-90 leading-snug">
              Brauzer sozlamalaridan yoki manzillar qatoridagi qulf belgisini bosib xabarnomalarga ruxsat bering.
            </span>
          </div>,
          { duration: 6000 }
        );
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });

      // Send to backend
      await api.post('/push/subscribe', subscription);

      setIsSubscribed(true);
      toast.success("Xabarnomalar muvaffaqiyatli ulandi! Endi ilova yopiq bo'lsa ham xabar keladi.");
      return true;
    } catch (error) {
      console.error('Push obunasida xatolik:', error);
      toast.error("Obuna bo'lishda xatolik yuz berdi.");
      return false;
    }
  };

  const unsubscribeFromPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      
      if (subscription) {
        // Unsubscribe from backend
        await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
        
        await subscription.unsubscribe();
        setIsSubscribed(false);
        toast.success("Xabarnomalar o'chirildi.");
      }
    } catch (error) {
      console.error('Push bekor qilishda xatolik:', error);
      toast.error("Bekor qilishda xatolik yuz berdi.");
    }
  };

  return {
    isSupported,
    permission,
    isSubscribed,
    subscribeToPush,
    unsubscribeFromPush
  };
};
