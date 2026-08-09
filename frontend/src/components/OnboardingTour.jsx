import React, { useState, useEffect } from 'react';
import * as ReactJoyrideModule from 'react-joyride';

const Joyride = ReactJoyrideModule.Joyride || ReactJoyrideModule;
const STATUS = ReactJoyrideModule.STATUS;

import { useAuth } from '../contexts/AuthContext';

const OnboardingTour = () => {
  const { user } = useAuth();
  
  // Only show if user is logged in
  if (!user) return null;

  const [run, setRun] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Check if the user has already seen the tour
    const hasSeenTour = localStorage.getItem('crm_has_seen_tour');
    if (!hasSeenTour) {
      // Delay slightly to ensure UI is fully rendered
      setTimeout(() => {
        setRun(true);
        // Mark as seen immediately when it auto-starts so it never pops up again automatically
        localStorage.setItem('crm_has_seen_tour', 'true');
      }, 1000);
    }
    
    // Add event listener so Settings can trigger the tour manually
    const handleRestartTour = () => {
      setRun(false);
      setTimeout(() => setRun(true), 100);
    };
    window.addEventListener('restart-tour', handleRestartTour);
    
    return () => {
      window.removeEventListener('restart-tour', handleRestartTour);
    };
  }, []);

  const steps = isMobile ? [
    {
      target: 'body',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2 text-primary">Xush kelibsiz! 🎉</h3>
          <p className="text-sm text-secondary">FERGANA OBOI tizimiga qisqacha sayohat uyushtiramiz. Bu dasturning imkoniyatlarini tezroq tushunib olishingizga yordam beradi.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.tour-mobile-dashboard',
      content: (
        <div>
          <h3 className="text-md font-bold mb-1 text-primary">1. Asosiy Bo'lim</h3>
          <p className="text-sm text-secondary">Bu yerda siz kunlik savdolar, tushumlar, qarzdorlik va umumiy statistikani bir qarashda ko'rishingiz mumkin.</p>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '.tour-mobile-products',
      content: (
        <div>
          <h3 className="text-md font-bold mb-1 text-primary">2. Katalog</h3>
          <p className="text-sm text-secondary">Mahsulotlar ro'yxati, rasmlari, narxlari va ombor qoldiqlari shu bo'limda joylagan.</p>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '.tour-mobile-cart',
      content: (
        <div>
          <h3 className="text-md font-bold mb-1 text-primary">3. Savat</h3>
          <p className="text-sm text-secondary">Mijozlar buyurtmalarini savatga yig'ib, tezkor sotuvni amalga oshirish imkoniyati.</p>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '.tour-mobile-orders',
      content: (
        <div>
          <h3 className="text-md font-bold mb-1 text-primary">4. Buyurtmalar</h3>
          <p className="text-sm text-secondary">Yangi buyurtma rasmiylashtirish va barcha savdolar tarixini shu bo'limdan ko'rasiz.</p>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: '.tour-mobile-customers',
      content: (
        <div>
          <h3 className="text-md font-bold mb-1 text-primary">5. Mijozlar Bazasi</h3>
          <p className="text-sm text-secondary">Mijozlar ro'yxati, ularning keshbek hisobi va barcha qarzdorliklarini shu yerdan kuzatasiz.</p>
        </div>
      ),
      placement: 'top',
      disableBeacon: true,
    },
    {
      target: 'body',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2 text-primary">Siz tayyorsiz! 🚀</h3>
          <p className="text-sm text-secondary">Endi bemalol dasturdan foydalanishingiz mumkin. Yo'riqnomani sozlamalar bo'limidan yana faollashtirsa bo'ladi.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    }
  ] : [
    {
      target: 'body',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2 text-primary">CRM Tizimiga Xush Kelibsiz! 🎉</h3>
          <p className="text-sm text-secondary">Sizga dasturning asosiy imkoniyatlarini va birinchi navbatda nima qilish kerakligini ko'rsatib o'tamiz. Qani ketdik!</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    },
    {
      target: '.tour-dashboard',
      content: (
        <div>
          <h3 className="text-md font-bold mb-1 text-primary">1. Dashboard</h3>
          <p className="text-sm text-secondary">Bu yerda siz kunlik savdolar, tushumlar, qarzdorlik va umumiy statistikani bir qarashda ko'rishingiz mumkin.</p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '.tour-warehouses',
      content: (
        <div>
          <h3 className="text-md font-bold mb-1 text-primary">2. Skladlar</h3>
          <p className="text-sm text-secondary">Ishni shu yerdan boshlang! Avvalo barcha skladlaringiz va do'konlaringizni tizimga qo'shing.</p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '.tour-products',
      content: (
        <div>
          <h3 className="text-md font-bold mb-1 text-primary">3. Mahsulotlar</h3>
          <p className="text-sm text-secondary">Sklad tayyor bo'lgach, oboylarni bu yerga kiritasiz. Mahsulotning rasmi, narxi va qoldiqlari shu yerdan boshqariladi.</p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '.tour-customers',
      content: (
        <div>
          <h3 className="text-md font-bold mb-1 text-primary">4. Mijozlar</h3>
          <p className="text-sm text-secondary">Savdo qilishdan oldin mijozlarni ro'yxatga olishingiz yoki ularning qarzlarini kuzatib borishingiz mumkin.</p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: '.tour-orders',
      content: (
        <div>
          <h3 className="text-md font-bold mb-1 text-primary">5. Buyurtmalar (Eng Asosiysi!)</h3>
          <p className="text-sm text-secondary">Yangi savdo qilish, mahsulot sotish va to'lovlarni qabul qilish aynan shu yerdan amalga oshiriladi.</p>
        </div>
      ),
      placement: 'right',
      disableBeacon: true,
    },
    {
      target: 'body',
      content: (
        <div>
          <h3 className="text-lg font-bold mb-2 text-primary">Siz Tayyorsiz! 🚀</h3>
          <p className="text-sm text-secondary">Endi bemalol dasturdan foydalanishingiz mumkin. Agar yo'riqnomani qayta ko'rmoqchi bo'lsangiz, uni sozlamalar bo'limidan yoqishingiz mumkin.</p>
        </div>
      ),
      placement: 'center',
      disableBeacon: true,
    }
  ];

  const handleJoyrideCallback = (data) => {
    const { status, action } = data;
    const finishedStatuses = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status) || action === 'close') {
      setRun(false);
      localStorage.setItem('crm_has_seen_tour', 'true');
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous={true}
      scrollToFirstStep={true}
      showProgress={true}
      showSkipButton={true}
      callback={handleJoyrideCallback}
      styles={{
        options: {
          arrowColor: 'var(--bg-surface)',
          backgroundColor: 'var(--bg-surface)',
          primaryColor: 'var(--accent-primary)',
          textColor: 'var(--text-primary)',
          overlayColor: 'rgba(0, 0, 0, 0.6)',
          zIndex: 10000,
        },
        buttonNext: {
          backgroundColor: 'var(--accent-primary)',
          borderRadius: '8px',
          padding: '8px 16px',
          color: 'var(--text-inverse)',
          fontWeight: 600,
        },
        buttonBack: {
          marginRight: '10px',
          color: 'var(--text-secondary)',
          fontWeight: 600,
        },
        buttonSkip: {
          color: 'var(--text-secondary)',
          fontWeight: 600,
        },
        buttonClose: {
          color: 'var(--text-secondary)',
        },
        tooltip: {
          borderRadius: '12px',
          padding: '20px',
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        }
      }}
      locale={{
        back: 'Orqaga',
        close: 'Yopish',
        last: 'Tugatish',
        next: 'Keyingisi',
        skip: 'O\'tkazib yuborish'
      }}
    />
  );
};

export default OnboardingTour;
