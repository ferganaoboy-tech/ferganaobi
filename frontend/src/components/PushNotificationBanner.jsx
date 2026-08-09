import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { useAuth } from '../contexts/AuthContext';

const PushNotificationBanner = () => {
  const { isSupported, permission, isSubscribed, subscribeToPush } = usePushNotifications();
  const { user } = useAuth();
  const location = useLocation();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('push_banner_dismissed');
    // Hide on login page to avoid overlapping the PIN pad
    const isLoginPage = location.pathname === '/login' || location.pathname === '/';
    
    if (user && !isLoginPage && isSupported && permission === 'default' && !isSubscribed && !dismissed) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 2500);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [isSupported, permission, isSubscribed, user, location.pathname]);

  const handleSubscribe = async () => {
    const success = await subscribeToPush();
    if (success) setIsVisible(false);
    else setIsVisible(false);
  };

  const handleClose = () => {
    setIsVisible(false);
    const expiryDate = new Date().getTime() + 7 * 24 * 60 * 60 * 1000; 
    localStorage.setItem('push_banner_dismissed', expiryDate.toString());
  };

  useEffect(() => {
    const dismissedExpiry = localStorage.getItem('push_banner_dismissed');
    if (dismissedExpiry && new Date().getTime() > parseInt(dismissedExpiry)) {
      localStorage.removeItem('push_banner_dismissed');
    }
  }, []);

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-[100] animate-in fade-in slide-in-from-top-4 w-[calc(100%-24px)] max-w-[360px]">
      <div className="bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-[18px] shadow-2xl p-2.5 flex items-center gap-3">
        
        {/* Icon */}
        <div className="w-9 h-9 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 animate-pulse" />
        </div>
        
        {/* Text Area */}
        <div className="flex-1 min-w-0 pr-1">
          <h4 className="font-semibold text-[13px] text-gray-900 dark:text-white leading-tight truncate">Xabarnomalarni yoqing</h4>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-tight truncate">Muhim o'zgarishlardan tezkor xabar toping.</p>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button 
            onClick={handleSubscribe}
            className="bg-blue-600 text-white px-3.5 py-1.5 rounded-full text-[12px] font-semibold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Yoqish
          </button>
          <button 
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        
      </div>
    </div>
  );
};

export default PushNotificationBanner;
