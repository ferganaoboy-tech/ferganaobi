import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, CheckCircle2, Store, ImageDown, Send } from 'lucide-react';
import { toPng } from 'html-to-image';
import { sendOrderReceiptToTelegram } from '../api';
import toast from 'react-hot-toast';

const CheckViewModal = ({ isOpen, onClose, order }) => {
  if (!isOpen || !order) return null;

  const receiptRef = useRef(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let timer;
    if (isOpen) {
      // 4 soniyadan keyin oynani avtomatik yopamiz (rasm chizishni kutmasdan)
      timer = setTimeout(() => {
        if (onClose) onClose();
      }, 4000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOpen, onClose]);

  const handleManualSend = async () => {
    if (!receiptRef.current) return;
    setSending(true);
    const toastId = toast.loading("Telegramga chek yuborilmoqda...");
    try {
      const dataUrl = await toPng(receiptRef.current, {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      await sendOrderReceiptToTelegram(order._id, dataUrl);
      toast.success("Chek yuborildi!", { id: toastId });
    } catch (err) {
      console.error('Telegramga yuborish xatosi:', err);
      toast.error("Yuborishda xatolik yuz berdi", { id: toastId });
    } finally {
      setSending(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleSendTelegram = () => {
    handleManualSend();
  };

  const handleSaveImage = async () => {
    if (!receiptRef.current) return;
    setSaving(true);
    try {
      const dataUrl = await toPng(receiptRef.current, {
        quality: 1.0,
        pixelRatio: 3,
        backgroundColor: '#ffffff',
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left'
        }
      });
      const link = document.createElement('a');
      link.download = `Chek-${orderId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Image save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const formatMoney = (amount) => amount ? amount.toLocaleString('ru-RU') + ' so\'m' : '0 so\'m';
  const orderId = order._id?.toString().slice(-6).toUpperCase() || '000000';
  const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString('uz-UZ', { 
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }) : '';

  return createPortal(
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 z-[100] transition-opacity duration-300 print:hidden ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className={`fixed inset-0 z-[101] flex items-center justify-center px-2 sm:px-4 pt-safe pb-safe pointer-events-none print:p-0 print:z-auto print:static print:flex-none print:items-start print:justify-start transition-all duration-300 ${
        isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95"
      }`}>
        
        {/* Paper Receipt */}
        <div className="bg-white text-gray-900 w-full max-w-[360px] max-h-[95dvh] sm:max-h-[90dvh] shadow-2xl rounded-xl overflow-hidden flex flex-col pointer-events-auto print:shadow-none print:w-[80mm] print:max-w-none print:rounded-none">
          
          {/* Action Bar (Hidden in Print) */}
          <div className="flex items-center justify-between p-3 bg-gray-100 border-b border-gray-200 print:hidden shrink-0">
            <h3 className="font-semibold text-gray-800 flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              Tasdiqlandi
            </h3>
          <div className="flex items-center gap-1">
              <button 
                onClick={handleSendTelegram}
                disabled={sending}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                title="Telegramga yuborish"
              >
                <Send className="w-4 h-4" />
              </button>
              <button 
                onClick={handleSaveImage}
                disabled={saving}
                className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                title="Rasmga saqlash"
              >
                <ImageDown className="w-4 h-4" />
              </button>
              <button 
                onClick={handlePrint}
                className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Chop etish"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button 
                onClick={onClose}
                className="p-1.5 text-gray-500 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Receipt Content - Scrollable on screen, full height on print */}
          <div className="print:p-0 flex-1 overflow-y-auto bg-white no-scrollbar flex justify-center">
            
            <div ref={receiptRef} className="p-4 print:p-0 receipt-content bg-white" style={{ width: '340px', maxWidth: '100%' }}>
              {/* Header */}
            <div className="flex flex-col items-center text-center mb-4">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mb-2 overflow-hidden">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-cover" />
              </div>
              <h2 className="text-lg font-bold uppercase tracking-wider mb-0.5 w-full">FERGANA OBOI</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest w-full">Kvitansiya / Chek</p>
            </div>

            <div className="border-t border-dashed border-gray-300 my-3"></div>

            {/* Meta */}
            <div className="space-y-1.5 text-[11px] leading-relaxed font-mono">
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-500 shrink-0">Buyurtma №:</span>
                <span className="font-semibold">#{orderId}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-500 shrink-0">Sana:</span>
                <span>{orderDate}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-500 shrink-0">Mijoz:</span>
                <span className="font-medium truncate max-w-[150px] text-right">{order.customer?.name || 'Noma\'lum mijoz'}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-500 shrink-0">Savdo turi:</span>
                <span>{order.type === 'wholesale' ? 'Sotuv' : 'Donabay'}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-500 shrink-0">Filial:</span>
                <span className="font-medium truncate max-w-[150px] text-right uppercase">{order.warehouse?.name || 'Noma\'lum filial'}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-500 shrink-0">Sotuvchi:</span>
                <span className="font-medium truncate max-w-[150px] text-right">{order.seller?.name || 'Asosiy'}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-300 my-3"></div>

            {/* Items */}
            <div className="space-y-2 font-mono text-[11px] leading-relaxed">
              <div className="flex justify-between items-start gap-2 font-bold border-b border-gray-200 pb-1.5 mb-1.5">
                <span>Nomi</span>
                <span>Summa</span>
              </div>
              {order.items?.map((item, index) => (
                <div key={index} className="flex flex-col mb-1.5">
                  <div className="flex justify-between font-medium">
                    <span className="truncate pr-2">{item.product?.name} ({item.product?.artikul})</span>
                    <span>{formatMoney(item.subtotal)}</span>
                  </div>
                  <div className="text-gray-500 text-[10px] mt-0.5">
                    {item.quantity} {item.unit} x {formatMoney(item.unitPrice)}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-dashed border-gray-300 my-3"></div>

            {/* Totals */}
            <div className="space-y-1.5 font-mono text-[11px] leading-relaxed">
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-500 shrink-0">Kiritilgan summa:</span>
                <span>{formatMoney(order.totalAmount + (order.discount || 0))}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between items-start gap-2 text-red-600">
                  <span>Chegirma:</span>
                  <span>-{formatMoney(order.discount)}</span>
                </div>
              )}
              <div className="flex justify-between items-start gap-2 text-[13px] font-bold mt-1.5 pt-1.5 border-t border-gray-200">
                <span>JAMI TUSHUM:</span>
                <span>{formatMoney(order.totalAmount)}</span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-300 my-3"></div>

            {/* Payment info */}
            <div className="space-y-1.5 font-mono text-[11px] leading-relaxed">
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-500 shrink-0">To'lov:</span>
                <span className="uppercase">{order.paymentType}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-500 shrink-0">To'landi:</span>
                <span className="font-semibold text-green-700">{formatMoney(order.paidAmount)}</span>
              </div>
              <div className="flex justify-between items-start gap-2">
                <span className="text-gray-500 shrink-0">Qarz:</span>
                <span className={order.debtAmount > 0 ? "text-red-600 font-bold" : ""}>
                  {formatMoney(order.debtAmount)}
                </span>
              </div>
            </div>

            <div className="border-t border-dashed border-gray-300 my-3"></div>

            {/* Footer */}
            <div className="text-center mt-4">
              <svg className="w-full h-8 mb-2 opacity-80" preserveAspectRatio="none">
                {/* Fake Barcode SVG */}
                <rect x="10%" y="0" width="2%" height="100%" fill="black" />
                <rect x="14%" y="0" width="1%" height="100%" fill="black" />
                <rect x="17%" y="0" width="3%" height="100%" fill="black" />
                <rect x="23%" y="0" width="1%" height="100%" fill="black" />
                <rect x="27%" y="0" width="4%" height="100%" fill="black" />
                <rect x="33%" y="0" width="2%" height="100%" fill="black" />
                <rect x="37%" y="0" width="1%" height="100%" fill="black" />
                <rect x="42%" y="0" width="3%" height="100%" fill="black" />
                <rect x="47%" y="0" width="2%" height="100%" fill="black" />
                <rect x="53%" y="0" width="4%" height="100%" fill="black" />
                <rect x="60%" y="0" width="1%" height="100%" fill="black" />
                <rect x="65%" y="0" width="2%" height="100%" fill="black" />
                <rect x="69%" y="0" width="1%" height="100%" fill="black" />
                <rect x="74%" y="0" width="3%" height="100%" fill="black" />
                <rect x="80%" y="0" width="2%" height="100%" fill="black" />
                <rect x="84%" y="0" width="1%" height="100%" fill="black" />
                <rect x="88%" y="0" width="2%" height="100%" fill="black" />
              </svg>
              <p className="font-mono text-[10px] text-gray-500 mb-3">{orderId}</p>
              
              <p className="text-[11px] font-bold text-gray-800">XARIDINGIZ UCHUN RAHMAT!</p>
              <p className="text-[9px] text-gray-500 mt-1">Sifatli oboylar - shinam uyingiz uchun</p>
            </div>

            </div>
          </div>
        </div>
      </div>
      
      {/* Print CSS Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .receipt-content, .receipt-content * {
            visibility: visible;
          }
          .receipt-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 80mm;
            margin: 0;
            padding: 0;
          }
        }
      `}} />
    </>,
    document.body
  );
};

export default CheckViewModal;
