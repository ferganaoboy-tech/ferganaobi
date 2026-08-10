import React, { useState } from 'react';
import { X, Sparkles, Loader2, ShoppingBag, CheckCircle2, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '../contexts/CartContext';
import api from '../api';

const AiOrderParserModal = ({ isOpen, onClose, cartWarehouse }) => {
  const [text, setText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState([]);
  const [step, setStep] = useState('input'); // 'input' | 'results'
  const { addToCart } = useCart();

  if (!isOpen) return null;

  // Oddiy frontend "AI" Parser (Simulyatsiya yoki haqiqiy regex logic)
  const handleParse = async () => {
    if (!text.trim()) {
      toast.error("Matn kiritilmadi!");
      return;
    }
    setIsParsing(true);
    
    try {
      const res = await api.post('/products/parse-order', { text });
      
      if (res.data?.success) {
        setParsedItems(res.data.data);
        setStep('results');
      } else {
        toast.error("Tahlil qilishda xatolik yuz berdi");
      }
    } catch (error) {
      console.error(error);
      toast.error("API ga ulanishda xatolik");
    } finally {
      setIsParsing(false);
    }
  };

  const handleAddAll = () => {
    let addedCount = 0;
    let hasWarehouseMismatch = false;

    parsedItems.forEach(item => {
      if (item.found && item.product) {
        const prodWarehouseId = item.product.warehouse?._id || item.product.warehouse;
        if (!cartWarehouse || cartWarehouse === prodWarehouseId) {
          const added = addToCart(item.product, item.requestedQty, item.product.unit || 'rulon');
          if(added) addedCount++;
        } else {
          hasWarehouseMismatch = true;
        }
      }
    });

    if (addedCount > 0) {
      toast.success(`${addedCount} xil maxsulot savatga qo'shildi!`);
      if(hasWarehouseMismatch) toast.error("Ba'zi maxsulotlar boshqa skladda bo'lgani uchun tushirib qoldirildi.");
      setText('');
      setParsedItems([]);
      setStep('input');
      onClose();
    } else if (hasWarehouseMismatch) {
      toast.error("Maxsulotlar boshqa skladda bo'lgani uchun qo'shilmadi.");
    } else {
      toast.error("Qo'shish uchun maxsulot topilmadi.");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-surface w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-50 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary leading-tight">AI Buyurtma Yig'uvchi</h2>
              <p className="text-13 text-tertiary">Mijoz yozgan matnni tashlang, qolganini AI bajaradi</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-subtle rounded-full transition-colors active:scale-95">
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        <div className="p-4 sm:p-6 flex-1 overflow-y-auto max-h-[70vh]">
          {step === 'input' ? (
            <div className="flex flex-col gap-4">
              <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4">
                <p className="text-13 text-indigo-800 font-medium mb-2">Qanday ishlaydi?</p>
                <p className="text-12 text-indigo-600">
                  Telegram yoki WhatsApp'dan mijoz yozgan ro'yxatni nusxalab, pastdagi maydonga joylang.
                  Masalan:<br/>
                  <i>"5 ta 101 oboy, 2 rulon 205 oq, 10 quti kley"</i>
                </p>
              </div>
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Mijoz xabarini bu yerga joylang (Ctrl+V)..."
                className="w-full h-48 p-4 bg-app border border-subtle rounded-xl text-14 text-primary focus:border-indigo-400 focus:ring-4 focus:ring-indigo-500/20 outline-none resize-none transition-all shadow-inner"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <h3 className="text-14 font-semibold text-primary mb-2">Tahlil natijalari:</h3>
              <div className="flex flex-col gap-2">
                {parsedItems.map((item, idx) => (
                  <div key={idx} className={`p-3 rounded-xl border flex items-center justify-between ${item.found ? 'bg-emerald-50/30 border-emerald-100' : 'bg-red-50/30 border-red-100'}`}>
                    <div className="flex flex-col gap-1 min-w-0">
                      <p className="text-13 font-medium text-secondary truncate">"{item.matchedText}"</p>
                      {item.found ? (
                        <div className="flex items-center gap-2 text-12 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Topildi: {item.product.brand || 'Brendsiz'} - {item.product.artikul}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-12 text-red-600 font-medium">
                          <AlertCircle className="w-3.5 h-3.5" />
                          Bazada bunday maxsulot topilmadi
                        </div>
                      )}
                    </div>
                    {item.found && (
                      <div className="shrink-0 flex flex-col items-end">
                        <span className="text-11 text-tertiary">Miqdor</span>
                        <span className="text-14 font-bold text-primary">{item.requestedQty} {item.product.unit || 'dona'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-subtle bg-surface flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
          {step === 'results' && (
            <button
              onClick={() => {
                setStep('input');
                setParsedItems([]);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl border border-subtle hover:bg-subtle text-secondary font-medium transition-colors active:scale-95 flex items-center justify-center"
            >
              Ortga qaytish
            </button>
          )}
          
          <button
            onClick={step === 'input' ? handleParse : handleAddAll}
            disabled={isParsing || (step === 'input' && !text.trim())}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-medium transition-all active:scale-95 flex items-center justify-center gap-2 text-white shadow-sm
              ${isParsing || (step === 'input' && !text.trim()) 
                ? 'bg-indigo-300 cursor-not-allowed' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20 hover:shadow-indigo-600/40'
              }`}
          >
            {isParsing ? (
              <><Loader2 className="w-4 h-4 animate-spin shrink-0" /> <span className="truncate">Tahlil qilinmoqda...</span></>
            ) : step === 'input' ? (
              <><Sparkles className="w-4 h-4 shrink-0" /> <span className="truncate">Matnni Tahlil Qilish</span></>
            ) : (
              <><ShoppingBag className="w-4 h-4 shrink-0" /> <span className="truncate">Barchasini Savatga Qo'shish</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiOrderParserModal;
