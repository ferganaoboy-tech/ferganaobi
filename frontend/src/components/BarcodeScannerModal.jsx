import React, { useEffect, useState, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { X, Camera, AlertCircle, Loader2 } from 'lucide-react';

const BarcodeScannerModal = ({ isOpen, onClose, onScan }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setIsReady(false);
      setError(null);
      setIsScanning(false);
      return;
    }

    const timer = setTimeout(() => {
      setIsReady(true);
    }, 200);

    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    if (!isReady) return;

    const html5QrCode = new Html5Qrcode("reader");
    scannerRef.current = html5QrCode;

    html5QrCode.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      (decodedText) => {
        html5QrCode.stop().then(() => {
          setIsScanning(false);
          onScan(decodedText);
        }).catch(e => console.error("Failed to stop scanner", e));
      },
      (err) => {
        // Ignore normal scan failures (e.g. no barcode found in current frame)
      }
    ).then(() => {
      setIsScanning(true);
    }).catch((err) => {
      console.error("Camera start error:", err);
      setError("Kameraga ulanishda xatolik yuz berdi yoki ruxsat etilmagan.");
    });

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current.stop().catch(e => {
          // Silently ignore cleanup errors
        });
      }
    };
  }, [isReady, onScan]);

  return (
    <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl transition-all duration-400 ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}`}>
      <style>{`
        #reader {
          border: none !important;
          background: transparent !important;
        }
        #reader video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
        @keyframes scanline {
          0% { transform: translateY(0); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(240px); opacity: 0; }
        }
        .animate-scanline {
          animation: scanline 2.5s linear infinite;
        }
      `}</style>
      
      <div className={`bg-[#121212] w-full sm:max-w-[400px] rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden transition-all duration-500 ring-1 ring-white/10 flex flex-col relative ${isOpen ? 'translate-y-0 opacity-100 sm:scale-100' : 'translate-y-full opacity-0 sm:translate-y-0 sm:scale-95'}`}>
        
        {/* Decorative Glow */}
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full blur-[80px] opacity-10 pointer-events-none bg-blue-500"></div>

        {/* Mobile drag handle */}
        <div className="flex justify-center pt-3 pb-2 sm:hidden shrink-0 relative z-10">
          <div className="w-10 h-1.5 bg-white/10 rounded-full" />
        </div>

        <div className="p-5 pb-3 flex items-center justify-between shrink-0 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-500/10 text-blue-400">
              <Camera className="w-5 h-5" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-17 font-[600] text-white tracking-tight">Skanerlash</h2>
              <p className="text-12 text-white/50 mt-0.5 font-[400]">Mahsulot shtrix-kodini qarating</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-all"
          >
            <X className="w-4 h-4" strokeWidth={2} />
          </button>
        </div>

        <div className="p-5 flex-1 relative z-10">
          <div className="relative w-full aspect-[4/4] bg-black/50 rounded-[28px] overflow-hidden border border-white/5 flex items-center justify-center shadow-inner">
            
            {/* Error State */}
            {error ? (
              <div className="flex flex-col items-center justify-center p-6 text-center z-20 absolute inset-0 bg-[#121212]/90 backdrop-blur-sm">
                <AlertCircle className="w-12 h-12 text-red-500 mb-4" strokeWidth={1.5} />
                <p className="text-14 font-[500] text-white/90 leading-relaxed mb-6">{error}</p>
                <button 
                  onClick={onClose} 
                  className="px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-full text-13 font-[600] text-white transition-all active:scale-95"
                >
                  Yopish
                </button>
              </div>
            ) : !isScanning ? (
              /* Loading State */
              <div className="flex flex-col items-center justify-center z-20 absolute inset-0 bg-[#121212]/80 backdrop-blur-sm">
                <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" strokeWidth={2} />
                <p className="text-13 font-[500] text-white/60">Kamera ishga tushmoqda...</p>
              </div>
            ) : null}

            {/* Video Container */}
            <div id="reader" className="absolute inset-0 w-full h-full"></div>

            {/* Custom Minimalist Overlay */}
            {isScanning && !error && (
              <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center bg-black/40">
                <div className="relative w-[240px] h-[240px] shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] rounded-2xl overflow-hidden">
                  
                  {/* Scan line */}
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.8)] animate-scanline"></div>
                  
                  {/* Corner markers */}
                  <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl"></div>
                  <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl"></div>
                  <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl"></div>
                  <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-2xl"></div>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6 mb-2 pb-safe flex justify-center">
            <div className="px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <p className="text-12 text-center text-white/50 font-[500] flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
                Avtomatik o'qiydi
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScannerModal;
