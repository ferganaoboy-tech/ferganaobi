import React, { useState, useEffect } from 'react';
import { X, Share, PlusSquare, Copy, Check, Info } from 'lucide-react';
import toast from 'react-hot-toast';

const PwaInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isIosDevice, setIsIosDevice] = useState(false);
  const [isSafari, setIsSafari] = useState(false);

  useEffect(() => {
    // 1. Detect if already installed (standalone mode)
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      window.navigator.standalone || 
      document.referrer.includes('android-app://');
    
    if (isStandalone) return;

    // 2. iOS Detection logic
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent) || (userAgent.includes("mac") && "ontouchend" in document);
    
    if (isIos) {
      setIsIosDevice(true);
      // Check if Safari (excluding Chrome, Firefox, Edge etc on iOS)
      const isSafariBrowser = /safari/.test(userAgent) && !/crios|fxios|opios|edgios/.test(userAgent);
      setIsSafari(isSafariBrowser);
      
      // Check if user dismissed it recently
      const dismissed = localStorage.getItem('pwa_ios_dismissed');
      if (!dismissed) {
        setIsVisible(true);
      }
    } else {
      // 3. Android / Desktop Detection
      const handler = (e) => {
        e.preventDefault();
        setDeferredPrompt(e);
        setIsVisible(true);
      };
      window.addEventListener('beforeinstallprompt', handler);
      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const handleInstallClick = async () => {
    if (isIosDevice) {
      setShowIosGuide(true);
      setIsVisible(false);
      return;
    }

    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
    if (isIosDevice) {
      localStorage.setItem('pwa_ios_dismissed', 'true');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setIsCopied(true);
      toast.success("Link nusxalandi! Endi Safari orqali kiring.");
      setTimeout(() => setIsCopied(false), 3000);
    } catch (err) {
      toast.error("Nusxalashda xatolik yuz berdi.");
    }
  };

  return (
    <>
      {/* ── MAIN BANNER ── */}
      {isVisible && (
        <div className="fixed bottom-20 md:bottom-auto md:top-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-6 z-[100] animate-in fade-in slide-in-from-bottom-5 md:slide-in-from-top-5 w-[calc(100%-32px)] max-w-[380px]">
          <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[22px] shadow-2xl p-2.5 flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-sm border border-black/5 dark:border-white/5 ml-0.5 bg-white">
              <img src="/logo.png" alt="Fergana Oboi" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-[14px] text-gray-900 dark:text-white leading-tight truncate">Fergana Oboi</h4>
              <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight truncate">Ekranga qo'shib oling</p>
            </div>
            <button 
              onClick={handleInstallClick}
              className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[13px] font-semibold hover:bg-blue-700 transition-colors shadow-sm shrink-0"
            >
              O'rnatish
            </button>
            <button 
              onClick={handleClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── IOS GUIDE MODAL ── */}
      {showIosGuide && (
        <div className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-end md:justify-center pb-8 md:pb-0 px-4 animate-in fade-in">
          
          <div className="bg-white dark:bg-[#1C1C1E] w-full max-w-sm rounded-[32px] p-6 shadow-2xl flex flex-col items-center text-center relative slide-in-from-bottom-10 md:slide-in-from-bottom-0 md:zoom-in-95">
            
            <button 
              onClick={() => setShowIosGuide(false)}
              className="absolute top-4 right-4 p-2 bg-gray-100 dark:bg-white/10 text-gray-500 hover:text-gray-700 rounded-full transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-16 h-16 bg-blue-50 dark:bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-600 mb-4 border border-blue-100 dark:border-blue-500/20">
              <img src="/logo.png" alt="App Icon" className="w-12 h-12 rounded-xl object-cover" />
            </div>

            <h3 className="text-[20px] font-bold text-gray-900 dark:text-white mb-2">
              Ilovani o'rnatish
            </h3>
            
            {isSafari ? (
              // SAFARI GUIDE
              <div className="space-y-5 w-full">
                <p className="text-[14px] text-gray-600 dark:text-gray-400 leading-relaxed">
                  Ilovani ekranga qo'shish uchun Safari menyusidan foydalaning.
                </p>
                <div className="bg-gray-50 dark:bg-black/20 rounded-2xl p-4 flex flex-col gap-3 border border-gray-100 dark:border-white/5">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-[#2C2C2E] flex items-center justify-center shadow-sm shrink-0 border border-gray-200 dark:border-white/10">
                      <Share className="w-4 h-4 text-blue-500" strokeWidth={2.5} />
                    </div>
                    <p className="text-[14px] font-medium text-gray-800 dark:text-gray-200">
                      1. Pastdagi <span className="text-blue-500">Ulashish</span> ikonkasini bosing
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-[#2C2C2E] flex items-center justify-center shadow-sm shrink-0 border border-gray-200 dark:border-white/10">
                      <PlusSquare className="w-4 h-4 text-gray-700 dark:text-gray-300" strokeWidth={2} />
                    </div>
                    <p className="text-[14px] font-medium text-gray-800 dark:text-gray-200">
                      2. <span className="font-bold">Ekranga qo'shish (Add to Home Screen)</span> ni tanlang
                    </p>
                  </div>
                </div>
                
                {/* Arrow pointing down for iPhones */}
                <div className="pt-2 animate-bounce">
                  <div className="w-0 h-0 border-l-[8px] border-l-transparent border-t-[12px] border-t-gray-300 dark:border-t-gray-600 border-r-[8px] border-r-transparent mx-auto"></div>
                </div>
              </div>
            ) : (
              // CHROME / TELEGRAM / OTHER GUIDE
              <div className="space-y-5 w-full">
                <div className="bg-red-50 dark:bg-red-500/10 border border-red-100 dark:border-red-500/20 rounded-2xl p-3 flex items-start gap-3 text-left">
                  <Info className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[13px] text-red-800 dark:text-red-200 leading-relaxed font-medium">
                    Siz hozir Safari brauzerida emassiz. Apple qoidalariga ko'ra, ilovani faqat Safari orqali o'rnatish mumkin.
                  </p>
                </div>
                <p className="text-[14px] text-gray-600 dark:text-gray-400">
                  Ilovani o'rnatish uchun manzildan nusxa oling va uni <b>Safari</b> da oching:
                </p>
                <button
                  onClick={handleCopyLink}
                  className="w-full flex items-center justify-center gap-2 bg-gray-100 dark:bg-white/10 hover:bg-gray-200 dark:hover:bg-white/20 text-gray-900 dark:text-white py-3.5 rounded-xl transition-colors font-semibold shadow-sm"
                >
                  {isCopied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
                  {isCopied ? "Nusxalandi!" : "Linkni nusxalash"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default PwaInstallBanner;
