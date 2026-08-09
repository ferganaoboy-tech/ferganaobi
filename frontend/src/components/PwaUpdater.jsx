import React, { useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCcw, X } from 'lucide-react';

const PwaUpdater = () => {
  const [isUpdating, setIsUpdating] = useState(false);
  
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // 1. Har 15 daqiqada tekshirish (oldingi 1 soat o'rniga)
        setInterval(() => {
          r.update();
        }, 15 * 60 * 1000);

        // 2. Ekran yonganda yoki ilovaga qaytilganda darhol tekshirish
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            r.update();
          }
        });
      }
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateServiceWorker(true);
      // Agar PWA an'anaviy yo'l bilan o'zini yangilasa
      setTimeout(() => {
        window.location.reload(true);
      }, 1500);
    } catch (err) {
      console.error("SW update failed, clearing caches forcefully:", err);
      // Senior Level: Agar oddiy yangilanish xato bersa (kesh qotsa), barcha keshni qirqib tashlaymiz
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
        } catch (e) {
          console.error("Cache clear error:", e);
        }
      }
      window.location.reload(true);
    }
  };

  if (!needRefresh && !offlineReady) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-bottom-5 w-[calc(100%-16px)] max-w-[380px]">
      <div className="bg-white dark:bg-[#1C1C1E] border border-blue-500/20 rounded-[16px] shadow-2xl p-3 flex flex-col gap-3">
        <div className="flex items-start justify-between">
          <div>
            <h4 className="font-semibold text-[14px] text-gray-900 dark:text-white leading-tight">
              {offlineReady ? 'Ilova oflayn ishlashga tayyor' : 'Yangi versiya tayyor!'}
            </h4>
            <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">
              {offlineReady 
                ? 'Endi internetsiz ham ishlata olasiz.' 
                : 'Ilovaning yangi versiyasi yuklab olindi. O\'zgarishlarni ko\'rish uchun yangilang.'}
            </p>
          </div>
          <button 
            onClick={close}
            disabled={isUpdating}
            className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full shrink-0 disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        {needRefresh && (
          <button 
            onClick={handleUpdate}
            disabled={isUpdating}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-[13px] font-semibold hover:bg-blue-700 transition-all disabled:opacity-70 active:scale-95"
          >
            <RefreshCcw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
            {isUpdating ? 'Yangilanmoqda...' : 'Hozir yangilash'}
          </button>
        )}
      </div>
    </div>
  );
};

export default PwaUpdater;
