import React, { useState } from 'react';
import { X, Sparkles, Loader2, ShoppingBag, CheckCircle2, AlertCircle, Mic } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart } from '../contexts/CartContext';
import api from '../api';

const AiOrderParserModal = ({ isOpen, onClose, cartWarehouse }) => {
  const [text, setText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [parsedItems, setParsedItems] = useState([]);
  const [step, setStep] = useState('input'); // 'input' | 'results'
  const [isRecording, setIsRecording] = useState(false);
  const [recognitionInstance, setRecognitionInstance] = useState(null);
  const { addToCart } = useCart();

  if (!isOpen) return null;

  const toggleRecording = () => {
    if (isRecording && recognitionInstance) {
      recognitionInstance.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Brauzeringiz ovozli kiritishni qo'llab-quvvatlamaydi (Chrome, Safari tavsiya etiladi).");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'uz-UZ';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
      toast.success("Gapiravering, eshityapman...");
    };

    let initialText = text ? text + (text.endsWith(' ') ? '' : ' ') : '';

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = 0; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      setText(initialText + finalTranscript + interimTranscript);
    };

    recognition.onerror = (event) => {
      console.error("SpeechRecognition error:", event.error);
      setIsRecording(false);
      if (event.error === 'not-allowed') {
        toast.error("Mikrofondan foydalanish uchun brauzerdan ruxsat berishingiz kerak!");
      } else if (event.error === 'network') {
        toast.error("Ovozli kiritish uchun internet kerak!");
      } else if (event.error !== 'no-speech') {
        toast.error("Ovoz yozishda kutilmagan xatolik yuz berdi.");
      }
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.start();
    setRecognitionInstance(recognition);
  };

  // Oddiy frontend "AI" Parser (Simulyatsiya yoki haqiqiy regex logic)
  const handleParse = async () => {
    if (!text.trim()) {
      toast.error("Matn kiritilmadi!");
      return;
    }
    
    // Tahlil boshlanganda mikrofonni avtomatik o'chiramiz
    if (isRecording && recognitionInstance) {
      recognitionInstance.stop();
      setIsRecording(false);
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-md p-4 animate-fade-in">
      <div className="bg-surface border border-subtle w-full max-w-2xl rounded-[1.5rem] shadow-2xl flex flex-col overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <h2 className="text-[17px] font-semibold text-primary tracking-tight">AI Buyurtma Yig'uvchi</h2>
          </div>
          <button onClick={onClose} className="text-tertiary hover:text-primary transition-colors active:scale-95 p-1 rounded-full hover:bg-raised">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 pb-6 flex-1 overflow-y-auto max-h-[70vh]">
          {step === 'input' ? (
            <div className="flex flex-col h-full">
              <div className="relative group rounded-2xl border border-subtle bg-app focus-within:border-focus focus-within:bg-surface transition-all overflow-hidden shadow-inner dark:shadow-none">
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Buyurtmani yozing yoki mikrofonga gapiring...&#10;Masalan: 102 artikuldan 5 ta"
                  className="w-full h-56 p-5 pb-16 bg-transparent outline-none resize-none text-[15px] leading-relaxed text-primary placeholder:text-disabled"
                />
                <div className="absolute bottom-3 right-3 flex items-center gap-3">
                  {isRecording && <span className="text-xs font-medium text-red-500 animate-pulse tracking-wide uppercase">Tinglanmoqda...</span>}
                  <button
                    onClick={toggleRecording}
                    className={`p-3 rounded-full transition-all flex items-center justify-center ${
                      isRecording 
                        ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' 
                        : 'bg-surface border border-subtle text-secondary hover:text-accent hover:border-accent/30'
                    }`}
                    title={isRecording ? "Yozishni to'xtatish" : "Ovozli kiritish"}
                  >
                    <Mic className={`w-4 h-4 ${isRecording ? 'animate-pulse' : ''}`} />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <h3 className="text-[15px] font-semibold text-primary">Tahlil natijalari</h3>
              <div className="flex flex-col gap-3">
                {parsedItems.map((item, idx) => (
                  <div key={idx} className={`p-4 rounded-[16px] border flex items-center justify-between transition-all bg-surface ${item.found ? 'border-subtle hover:border-default' : 'border-red-200/60 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10'}`}>
                    
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Icon Container */}
                      <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${item.found ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
                        {item.found ? <CheckCircle2 className="w-5 h-5" strokeWidth={2.5} /> : <AlertCircle className="w-5 h-5" strokeWidth={2.5} />}
                      </div>
                      
                      {/* Text Data */}
                      <div className="flex flex-col min-w-0">
                        {item.found ? (
                          <>
                            <p className="text-[15px] font-[600] text-primary truncate leading-tight mb-0.5">
                              {item.product.brand || 'Brendsiz'} <span className="opacity-50 mx-0.5">•</span> {item.product.artikul}
                            </p>
                            <p className="text-[12.5px] text-tertiary truncate font-medium">
                              "{item.matchedText}"
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-[14px] font-[600] text-red-600 dark:text-red-400 truncate leading-tight mb-0.5">
                              Bazada topilmadi
                            </p>
                            <p className="text-[12.5px] text-tertiary truncate font-medium">
                              "{item.matchedText}"
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quantity */}
                    {item.found && (
                      <div className="shrink-0 flex items-baseline gap-1.5 ml-4 pl-4 border-l border-subtle">
                        <span className="text-[18px] font-[700] text-primary leading-none tracking-tight">{item.requestedQty}</span>
                        <span className="text-[13px] font-[500] text-tertiary">{item.product.unit || 'dona'}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 pb-6 pt-2 flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
          {step === 'results' && (
            <button
              onClick={() => {
                setStep('input');
                setParsedItems([]);
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-full border border-default bg-transparent hover:bg-raised text-secondary text-[14px] font-medium transition-all active:scale-95 flex items-center justify-center"
            >
              Ortga qaytish
            </button>
          )}
          
          <button
            onClick={step === 'input' ? handleParse : handleAddAll}
            disabled={isParsing || (step === 'input' && !text.trim())}
            className={`w-full sm:w-auto px-6 py-2.5 rounded-full text-[14px] font-medium transition-all active:scale-[0.98] flex items-center justify-center gap-2
              ${isParsing || (step === 'input' && !text.trim()) 
                ? 'bg-raised text-disabled cursor-not-allowed' 
                : 'bg-accent text-inverse hover:bg-accent-hover shadow-lg hover:-translate-y-0.5'
              }`}
          >
            {isParsing ? (
              <><Loader2 className="w-4 h-4 animate-spin shrink-0" /> <span className="truncate">Tahlil qilinmoqda...</span></>
            ) : step === 'input' ? (
              <><Sparkles className="w-4 h-4 shrink-0" /> <span className="truncate">Tahlil qilish</span></>
            ) : (
              <><ShoppingBag className="w-4 h-4 shrink-0" /> <span className="truncate">Savatga qo'shish</span></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiOrderParserModal;
