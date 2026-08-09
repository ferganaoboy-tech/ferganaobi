import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, DollarSign, Trash2, RefreshCw, AlertTriangle, ShieldAlert, Database, Image as ImageIcon, Send, ShoppingBag, CheckCircle, XCircle, Clock, ToggleLeft, ToggleRight } from 'lucide-react';
import { useSettings, useUpdateSettings } from '../hooks/useSettings';
import { useTelegramSubscribers, useApproveSubscriber, useRejectSubscriber } from '../hooks/useTelegramSubscribers';
import { recalculateDebts, sendDailyReportTelegram } from '../api';
import toast from 'react-hot-toast';
import { BounceLoader } from 'react-spinners';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { usePushNotifications } from '../hooks/usePushNotifications';
import DatabaseManager from '../components/DatabaseManager';

const SettingsPage = () => {
  const { user } = useAuth();
  
  // Guard for superadmin/admin
  if (user && !['superadmin', 'admin'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const { data: settingsRes, isLoading } = useSettings();
  const updateSettingsMutation = useUpdateSettings();

  const { data: tgRes, isLoading: tgLoading } = useTelegramSubscribers();
  const approveTg = useApproveSubscriber();
  const rejectTg = useRejectSubscriber();

  const { isSupported, permission, isSubscribed, subscribeToPush, unsubscribeFromPush } = usePushNotifications();

  const [usdRate, setUsdRate] = useState('');
  const [cartFields, setCartFields] = useState({
    showCustomer: true,
    showAddress: true,
    showDate: true,
    showNotes: true
  });
  const [shiftEnabled, setShiftEnabled] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isSendingReport, setIsSendingReport] = useState(false);

  useEffect(() => {
    if (settingsRes?.data) {
      setUsdRate(settingsRes.data.usdExchangeRate);
      if (settingsRes.data.cartFields) {
        setCartFields(settingsRes.data.cartFields);
      }
      // features.shiftEnabled — bo'lmasa default false
      setShiftEnabled(settingsRes.data.features?.shiftEnabled ?? false);
    }
  }, [settingsRes]);

  // Smena toggle — darhol saqlaydi (debounce kerak emas)
  const handleShiftToggle = (newValue) => {
    setShiftEnabled(newValue);
    updateSettingsMutation.mutate(
      { features: { shiftEnabled: newValue } },
      {
        onSuccess: () => {
          toast.success(
            newValue
              ? '✅ Smena tizimi yoqildi! Kassirlar endi smena ochishi shart.'
              : '⏸️ Smena tizimi o\'chirildi. Kassirlar smena ochmasdan savdo qila oladi.',
            { duration: 4000 }
          );
        },
        onError: (err) => {
          setShiftEnabled(!newValue); // Xato bo'lsa eski holatga qaytarish
          toast.error(err.response?.data?.message || 'Xatolik yuz berdi');
        }
      }
    );
  };

  const handleSave = () => {
    if (!usdRate || isNaN(usdRate) || usdRate <= 0) {
      return toast.error("Iltimos, to'g'ri valyuta kursini kiriting");
    }

    updateSettingsMutation.mutate({ usdExchangeRate: Number(usdRate), cartFields }, {
      onSuccess: () => {
        toast.success("Sozlamalar saqlandi!");
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || "Xatolik yuz berdi");
      }
    });
  };



  const handleRecalculate = async () => {
    setIsRecalculating(true);
    try {
      const res = await recalculateDebts();
      toast.success(res.message || "Qarzlar qayta hisoblandi!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Xatolik yuz berdi");
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSendReport = async () => {
    setIsSendingReport(true);
    try {
      const res = await sendDailyReportTelegram();
      toast.success(res.message || "Hisobot yuborildi!");
    } catch (err) {
      toast.error(err.response?.data?.message || "Xatolik yuz berdi");
    } finally {
      setIsSendingReport(false);
    }
  };

  if (isLoading || tgLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full gap-4 pt-20">
        <BounceLoader color="var(--accent-primary)" size={45} />
        <span className="text-13 text-secondary animate-pulse font-[500]">Yuklanmoqda...</span>
      </div>
    );
  }

  const tgSubscribers = tgRes?.data || [];
  const pendingTg = tgSubscribers.filter(s => !s.isApproved);
  const approvedTg = tgSubscribers.filter(s => s.isApproved);

  return (
    <div className="p-2 sm:p-[32px_40px] pb-28 sm:pb-12 w-full max-w-[1600px] mx-auto animate-in fade-in duration-300">
      <div className="flex items-center gap-3 mb-[24px] sm:mb-[32px] shrink-0 px-2 sm:px-0">
        <div className="w-10 h-10 rounded-lg bg-surface border border-subtle flex items-center justify-center shadow-sm">
          <SettingsIcon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-[24px] sm:text-28 font-[600] tracking-[-0.03em] text-primary leading-tight">Sozlamalar</h1>
          <p className="text-13 sm:text-14 text-secondary mt-1">Tizimning umumiy parametrlari va xotira holati</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 items-start">
        {/* Left Column */}
        <div className="flex flex-col gap-6">
          {/* 1. Valyuta Kursi */}
          <div className="bg-surface border border-subtle rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
            <h2 className="text-16 font-[600] text-primary mb-6 flex items-center gap-2 border-b border-subtle pb-4">
              <DollarSign className="w-5 h-5 text-state-success-text" /> Valyuta Kursi
            </h2>

            <div>
              <label className="block text-13 font-[500] text-secondary mb-2">1 USD kursi (So'mda)</label>
              <div className="relative">
                <input 
                  type="number"
                  value={usdRate}
                  onChange={(e) => setUsdRate(e.target.value)}
                  className="w-full h-[46px] bg-app border border-subtle hover:border-default focus:border-focus rounded-xl px-4 text-15 font-mono text-primary outline-none transition-all shadow-sm"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-13 text-tertiary font-[500]">UZS</div>
              </div>
              <p className="text-12 text-tertiary mt-3 leading-relaxed bg-subtle p-3 rounded-lg border border-subtle">
                Ushbu kursni o'zgartirganingizda, Dollarda narx belgilangan barcha mahsulotlarning So'mdagi narxi <strong className="text-primary">avtomatik tarzda qayta hisoblanadi.</strong>
              </p>

              <button 
                onClick={handleSave}
                disabled={updateSettingsMutation.isLoading}
                className="mt-6 h-[42px] px-6 bg-accent text-inverse rounded-xl text-14 font-[500] hover:bg-accent-hover active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm w-fit"
              >
                <Save className="w-[18px] h-[18px]" strokeWidth={1.5} /> 
                {updateSettingsMutation.isLoading ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>

          {/* 1.5 Cart Fields */}
          <div className="bg-surface border border-subtle rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
            <h2 className="text-16 font-[600] text-primary mb-6 flex items-center gap-2 border-b border-subtle pb-4">
              <ShoppingBag className="w-5 h-5 text-indigo-500" /> Savat Oynasi Sozlamalari
            </h2>

            <div className="space-y-4">
              <p className="text-13 text-secondary mb-4 leading-relaxed">
                Buyurtma rasmiylashtirish oynasida qaysi maydonlar ko'rinishini tanlang. Ortiqcha maydonlarni o'chirib qo'yish orqali jarayonni tezlashtirishingiz mumkin.
              </p>

              {[
                { id: 'showCustomer', label: 'Mijoz tanlash' },
                { id: 'showAddress', label: 'Yetkazish manzili' },
                { id: 'showDate', label: 'Sana' },
                { id: 'showNotes', label: 'Izoh' }
              ].map(field => (
                <label key={field.id} className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="sr-only"
                      checked={cartFields[field.id]}
                      onChange={(e) => setCartFields(prev => ({ ...prev, [field.id]: e.target.checked }))}
                    />
                    <div className={`w-11 h-6 rounded-full transition-colors ${cartFields[field.id] ? 'bg-accent' : 'bg-subtle border border-default'}`}>
                      <div className={`absolute top-1 w-4 h-4 rounded-full shadow-sm transition-all duration-200 ${cartFields[field.id] ? 'left-[22px] bg-inverse' : 'left-1 bg-white'}`} />
                    </div>
                  </div>
                  <span className="text-14 font-[500] text-primary group-hover:text-accent transition-colors">{field.label}</span>
                </label>
              ))}

              <button 
                onClick={handleSave}
                disabled={updateSettingsMutation.isPending}
                className="mt-6 h-[42px] px-6 bg-accent text-inverse rounded-xl text-14 font-[500] hover:bg-accent-hover active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50 shadow-sm w-fit"
              >
                <Save className="w-[18px] h-[18px]" strokeWidth={1.5} /> 
                {updateSettingsMutation.isPending ? 'Saqlanmoqda...' : 'Saqlash'}
              </button>
            </div>
          </div>

          {/* ─── Smena Tizimi (Feature Flag) ─────────────────────────────── */}
          <div className="bg-surface border border-subtle rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
            <h2 className="text-16 font-[600] text-primary mb-6 flex items-center gap-2 border-b border-subtle pb-4">
              <Clock className="w-5 h-5 text-amber-500" /> Smena Boshqaruvi
            </h2>

            <div className="space-y-5">
              {/* Status badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-12 font-[700] tracking-wide ${
                shiftEnabled
                  ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                  : 'bg-subtle text-tertiary border border-subtle'
              }`}>
                <span className={`w-2 h-2 rounded-full ${shiftEnabled ? 'bg-emerald-500 animate-pulse' : 'bg-subtle border border-default'}`} />
                {shiftEnabled ? 'YOQILGAN' : 'O\'CHIRILGAN'}
              </div>

              <p className="text-13 text-secondary leading-relaxed">
                Bu funksiya <strong className="text-primary">yoqilgan</strong> bo'lsa, kassirlar har kuni ish boshida
                <strong className="text-primary"> smena ochishi</strong> va ish oxirida yopishi shart bo'ladi.
                O'chirilgan bo'lsa — kassirlar smena ochmasdan ham savdo qila oladi.
              </p>

              {/* Animatsiyali toggle */}
              <label className="flex items-center justify-between cursor-pointer group select-none py-3 px-4 rounded-xl border border-subtle hover:bg-raised transition-all">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                    shiftEnabled ? 'bg-emerald-500/15 text-emerald-500' : 'bg-subtle text-tertiary'
                  }`}>
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-14 font-[600] text-primary">Smena tizimini yoqish</div>
                    <div className="text-12 text-tertiary mt-0.5">
                      {shiftEnabled ? 'Kassirlar smena ochishi shart' : 'Smena tekshiruvi o\'chirilgan'}
                    </div>
                  </div>
                </div>
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={shiftEnabled}
                    disabled={updateSettingsMutation.isPending}
                    onChange={(e) => handleShiftToggle(e.target.checked)}
                  />
                  <div className={`w-12 h-6.5 rounded-full transition-all duration-300 ${
                    shiftEnabled ? 'bg-emerald-500' : 'bg-subtle border border-default'
                  } ${updateSettingsMutation.isPending ? 'opacity-50' : ''}`}
                    style={{ height: '26px' }}
                    onClick={() => !updateSettingsMutation.isPending && handleShiftToggle(!shiftEnabled)}
                  >
                    <div className={`absolute top-[3px] w-5 h-5 rounded-full shadow-md transition-all duration-300 ${
                      shiftEnabled ? 'translate-x-[26px] bg-white' : 'translate-x-[3px] bg-white'
                    }`} />
                  </div>
                </div>
              </label>

              {/* Ogohlantirish — yoqilganda */}
              {shiftEnabled && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/8 border border-amber-500/20">
                  <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                  <p className="text-12 text-amber-600 leading-relaxed">
                    Smena tizimi yoqilgan. Kassirlar smena ochmasdan savdo qila olmaydi.
                    Agar smenalar allaqachon ochiq bo'lsa — ular davom etadi.
                  </p>
                </div>
              )}
            </div>
          </div>


          <div className="bg-surface border border-subtle rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
            <h2 className="text-16 font-[600] text-primary mb-6 flex items-center gap-2 border-b border-subtle pb-4">
              <RefreshCw className="w-5 h-5 text-state-info-text" /> Tizim Xizmatlari
            </h2>

            <div>
              <p className="text-13 text-secondary mb-5 leading-relaxed">
                Agar mijozlarning qarzdorlik raqamlari noto'g'ri ko'rinsa, ushbu tugma orqali barcha qarzlarni haqiqiy buyurtmalar asosida <strong className="text-primary">qayta hisoblash</strong> mumkin. Shuningdek, dastur yo'riqnomasini (Tour Guide) qayta ishga tushirishingiz mumkin.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button 
                  onClick={handleRecalculate}
                  disabled={isRecalculating}
                  className="h-[42px] px-6 bg-state-info-bg text-state-info-text border border-state-info-border rounded-xl text-14 font-[600] hover:opacity-90 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${isRecalculating ? 'animate-spin' : ''}`} strokeWidth={2} />
                  {isRecalculating ? 'Hisoblanmoqda...' : 'Qarzlarni qayta hisoblash'}
                </button>

                <button 
                  onClick={() => {
                    window.dispatchEvent(new Event('restart-tour'));
                  }}
                  className="h-[42px] px-6 bg-app text-primary border border-subtle rounded-xl text-14 font-[600] hover:bg-subtle active:scale-95 transition-all flex items-center gap-2"
                >
                  Yo'riqnomani Qayta Ko'rish
                </button>

                <button 
                  onClick={handleSendReport}
                  disabled={isSendingReport}
                  className="h-[42px] px-6 bg-[#0088cc]/10 text-[#0088cc] border border-[#0088cc]/20 rounded-xl text-14 font-[600] hover:bg-[#0088cc]/20 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Send className={`w-4 h-4 ${isSendingReport ? 'animate-pulse' : ''}`} strokeWidth={2} />
                  {isSendingReport ? 'Yuborilmoqda...' : 'Telegram hisobot yuborish'}
                </button>
              </div>
            </div>
          </div>

          {/* Web Push (Ilovadan tashqari) Xabarnomalar */}
          <div className="bg-surface border border-subtle rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
            <h2 className="text-16 font-[600] text-primary mb-6 flex items-center gap-2 border-b border-subtle pb-4">
              <span className="w-5 h-5 flex items-center justify-center bg-[#0088cc]/10 text-[#0088cc] rounded-full">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0088cc] animate-pulse"></span>
              </span>
              Telefon Xabarnomalari (Web Push)
            </h2>

            <div>
              <p className="text-13 text-secondary mb-5 leading-relaxed">
                Tizimdan chiqib ketsangiz ham (ilovadan tashqarida) o'tkazmalar haqida bevosita qurilmangizga bildirishnomalar olish uchun ushbu xizmatni yoqing. Android'da muammosiz ishlaydi. iPhone'da ishlashi uchun avval ilovani asosiy ekranga (Add to Home Screen) qo'shishingiz kerak.
              </p>
              
              {!isSupported ? (
                <div className="text-13 text-state-danger-text bg-state-danger-bg p-3 rounded-xl border border-state-danger-border">
                  Sizning brauzeringiz yoki qurilmangiz Web Push xabarnomalarini qo'llab-quvvatlamaydi. iPhone ishlatayotgan bo'lsangiz avval Safari'dan ilovani asosiy ekranga qo'shing.
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  {isSubscribed ? (
                    <button 
                      onClick={unsubscribeFromPush}
                      className="h-[42px] px-6 bg-app text-state-danger-text border border-state-danger-border rounded-xl text-14 font-[600] hover:bg-state-danger-bg active:scale-95 transition-all flex items-center gap-2"
                    >
                      <XCircle className="w-4 h-4" strokeWidth={2} />
                      O'chirish
                    </button>
                  ) : (
                    <button 
                      onClick={subscribeToPush}
                      className="h-[42px] px-6 bg-accent text-inverse rounded-xl text-14 font-[500] hover:bg-accent-hover active:scale-95 transition-all flex items-center gap-2 shadow-sm"
                    >
                      <CheckCircle className="w-4 h-4" strokeWidth={2} />
                      Xabarnomalarni Yoqish
                    </button>
                  )}
                  {permission === 'denied' && (
                    <div className="text-12 text-state-warning-text flex-1">
                      Siz xabarnomalarni bloklagansiz. Brauzer sozlamalaridan ruxsat bering.
                    </div>
                  )}
                  {isSubscribed && (
                    <div className="text-13 text-state-success-text font-[500] flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" /> Yoqilgan
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column */}
        <div className="flex flex-col gap-6">
          {/* 3. Ma'lumotlar Bazasi (Xotira) */}
          <div className="bg-surface border border-subtle rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
            <h2 className="text-16 font-[600] text-primary mb-6 flex items-center gap-2 border-b border-subtle pb-4">
              <Database className="w-5 h-5 text-indigo-500" /> Ma'lumotlar Bazasi (Xotira)
            </h2>
            <div>
              {settingsRes?.dbStats ? (() => {
                const usedBytes = settingsRes.dbStats.dataSize || 0;
                // MongoDB Atlas free tier typical limit is 512MB
                const maxBytes = 512 * 1024 * 1024;
                const usedMB = (usedBytes / (1024 * 1024)).toFixed(2);
                const maxMB = 512;
                const percent = Math.min(100, (usedBytes / maxBytes) * 100).toFixed(2);
                
                return (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-14 font-[500] text-secondary">Band qilingan joy:</span>
                      <span className="text-14 font-[600] text-primary">{usedMB} MB / {maxMB} MB</span>
                    </div>
                    <div className="w-full bg-app rounded-full h-3.5 mb-4 overflow-hidden border border-subtle shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ease-out ${percent > 90 ? 'bg-state-danger-text' : percent > 70 ? 'bg-state-warning-text' : 'bg-indigo-500'}`} 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                    <p className="text-13 text-tertiary leading-relaxed">
                      Jami ma'lumotlar bazasida <strong>{percent}%</strong> joy band qilingan. Bo'sh joy miqdori: <strong>{(maxMB - usedMB).toFixed(2)} MB</strong>. Bu joy tizimdagi barcha mahsulotlar, buyurtmalar, va xaridorlar ro'yxati uchun sarflanadi.
                    </p>
                  </div>
                );
              })() : (
                <div className="text-13 text-tertiary">Ma'lumotlar bazasi xotirasi haqida ma'lumot topilmadi.</div>
              )}
            </div>
          </div>

          {/* 4. Cloudinary (Rasmlar Xotirasi) */}
          <div className="bg-surface border border-subtle rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
            <h2 className="text-16 font-[600] text-primary mb-6 flex items-center gap-2 border-b border-subtle pb-4">
              <ImageIcon className="w-5 h-5 text-cyan-500" /> Rasmlar Xotirasi (Cloudinary)
            </h2>
            <div>
              {settingsRes?.cloudinaryStats ? (() => {
                const storage = settingsRes.cloudinaryStats.storage || {};
                const usedBytes = storage.usage || 0;
                // Cloudinary free tier limit is around 25 GB. Defaulting if limit is missing.
                const maxBytes = storage.limit || 25 * 1024 * 1024 * 1024;
                const usedMB = (usedBytes / (1024 * 1024)).toFixed(2);
                const maxGB = (maxBytes / (1024 * 1024 * 1024)).toFixed(2);
                const percent = storage.used_percent ? (storage.used_percent * 100).toFixed(2) : Math.min(100, (usedBytes / maxBytes) * 100).toFixed(2);
                
                return (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-14 font-[500] text-secondary">Band qilingan joy:</span>
                      <span className="text-14 font-[600] text-primary">{usedMB} MB / {maxGB} GB</span>
                    </div>
                    <div className="w-full bg-app rounded-full h-3.5 mb-4 overflow-hidden border border-subtle shadow-inner">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ease-out ${percent > 90 ? 'bg-state-danger-text' : percent > 70 ? 'bg-state-warning-text' : 'bg-cyan-500'}`} 
                        style={{ width: `${percent}%` }}
                      ></div>
                    </div>
                    <p className="text-13 text-tertiary leading-relaxed">
                      Jami rasmlar xotirasida (Cloudinary) <strong>{percent}%</strong> joy band qilingan. Bu xotiradan faqat mahsulot rasmlari joy oladi.
                    </p>
                  </div>
                );
              })() : (
                <div className="text-13 text-tertiary">Cloudinary xotirasi haqida ma'lumot topilmadi yoki API sozlanmagan.</div>
              )}
            </div>
          </div>

          {/* Telegram Bot Boshqaruvi */}
          <div className="bg-surface border border-subtle rounded-xl sm:rounded-2xl p-4 sm:p-6 shadow-sm">
            <h2 className="text-16 font-[600] text-[#0088cc] mb-6 flex items-center gap-2 border-b border-subtle pb-4">
              <Send className="w-5 h-5 text-[#0088cc]" /> Telegram Bot Boshqaruvi
            </h2>
            
            <p className="text-13 text-secondary mb-5 leading-relaxed">
              Botga kirish uchun ruxsat so'ragan foydalanuvchilar va ruxsat berilgan foydalanuvchilarni shu yerdan boshqaring.
            </p>

            <div className="space-y-6">
              {/* Kutilayotgan so'rovlar */}
              <div>
                <h3 className="text-14 font-[600] text-primary mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-state-warning-text animate-pulse"></span>
                  Kutilayotgan So'rovlar ({pendingTg.length})
                </h3>
                {pendingTg.length === 0 ? (
                  <div className="text-13 text-tertiary italic bg-app p-3 rounded-xl border border-subtle text-center">Yangi so'rovlar yo'q</div>
                ) : (
                  <div className="space-y-2">
                    {pendingTg.map(sub => (
                      <div key={sub._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-app border border-subtle rounded-xl">
                        <div>
                          <div className="text-14 font-[600] text-primary">{sub.firstName || 'Nomsiz'} {sub.username ? `(@${sub.username})` : ''}</div>
                          <div className="text-12 text-tertiary">ID: {sub.chatId}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => approveTg.mutate(sub._id)}
                            disabled={approveTg.isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-state-success-bg text-state-success-text rounded-lg hover:opacity-90 active:scale-95 transition-all text-13 font-[600]"
                          >
                            <CheckCircle className="w-4 h-4" /> Ruxsat
                          </button>
                          <button 
                            onClick={() => rejectTg.mutate(sub._id)}
                            disabled={rejectTg.isLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-state-danger-bg text-state-danger-text rounded-lg hover:opacity-90 active:scale-95 transition-all text-13 font-[600]"
                          >
                            <XCircle className="w-4 h-4" /> Rad etish
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Tasdiqlanganlar */}
              <div>
                <h3 className="text-14 font-[600] text-primary mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-state-success-text"></span>
                  Ruxsat etilgan Foydalanuvchilar ({approvedTg.length})
                </h3>
                {approvedTg.length === 0 ? (
                  <div className="text-13 text-tertiary italic bg-app p-3 rounded-xl border border-subtle text-center">Tasdiqlanganlar yo'q</div>
                ) : (
                  <div className="space-y-2">
                    {approvedTg.map(sub => (
                      <div key={sub._id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-app border border-subtle rounded-xl">
                        <div>
                          <div className="text-14 font-[600] text-primary">{sub.firstName || 'Nomsiz'} {sub.username ? `(@${sub.username})` : ''}</div>
                          <div className="text-12 text-tertiary">ID: {sub.chatId}</div>
                        </div>
                        <button 
                          onClick={() => {
                            if(window.confirm("Ruxsatni bekor qilib, o'chirib yuborasizmi?")) {
                              rejectTg.mutate(sub._id);
                            }
                          }}
                          disabled={rejectTg.isLoading}
                          className="px-3 py-1.5 bg-app text-state-danger-text border border-state-danger-border rounded-lg hover:bg-state-danger-bg active:scale-95 transition-all text-13 font-[600]"
                        >
                          O'chirish
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 5. Database Manager (New Modular Danger Zone) */}
          <DatabaseManager />
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
