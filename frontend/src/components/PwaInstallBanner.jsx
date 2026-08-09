import React, { useState, useEffect } from 'react';
import { Download, X } from 'lucide-react';

const PwaInstallBanner = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-20 md:bottom-auto md:top-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-6 z-[100] animate-in fade-in slide-in-from-bottom-5 md:slide-in-from-top-5 w-[calc(100%-32px)] max-w-[380px]">
      <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[22px] shadow-2xl p-2.5 flex items-center gap-3">
        
        {/* App Icon */}
        <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 shadow-sm border border-black/5 dark:border-white/5 ml-0.5 bg-white">
          <img src="/logo.png" alt="Fergana Oboi" className="w-full h-full object-cover" />
        </div>
        
        {/* Text Area */}
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-[14px] text-gray-900 dark:text-white leading-tight truncate">Fergana Oboi</h4>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight truncate">Ekranga qo'shib oling</p>
        </div>
        
        {/* Install Button */}
        <button 
          onClick={handleInstallClick}
          className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[13px] font-semibold hover:bg-blue-700 transition-colors shadow-sm shrink-0"
        >
          O'rnatish
        </button>
        
        {/* Close Button */}
        <button 
          onClick={handleClose}
          className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/10 rounded-full transition-colors shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
        
      </div>
    </div>
  );
};

export default PwaInstallBanner;
