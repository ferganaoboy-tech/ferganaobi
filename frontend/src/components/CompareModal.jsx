import React from 'react';
import { X, Send, Scale, Grid3X3, Package } from 'lucide-react';
import { useCompareProducts } from '../hooks/useProducts';
import { useAuth } from '../contexts/AuthContext';
import { useTransfer } from '../contexts/TransferContext';
import { formatQuantity } from '../utils/format';
import { haptics } from '../utils/haptics';

const CompareModal = ({ isOpen, onClose, product }) => {
  const { user } = useAuth();
  const { addToTransfer } = useTransfer();
  const { data: compareData, isLoading } = useCompareProducts(product?.artikul, product?.brand);

  if (!isOpen || !product) return null;

  const compareProducts = compareData?.data || [];
  
  // Sort products to put current user's warehouse first if applicable
  const sortedProducts = [...compareProducts].sort((a, b) => {
    const aIsMy = String(a.warehouse?._id) === String(user?.warehouse?._id || user?.warehouse);
    const bIsMy = String(b.warehouse?._id) === String(user?.warehouse?._id || user?.warehouse);
    if (aIsMy && !bIsMy) return -1;
    if (!aIsMy && bIsMy) return 1;
    return (b.quantity || 0) - (a.quantity || 0); // then sort by quantity
  });

  return (
    <>
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[90] animate-in fade-in duration-200"
        onClick={onClose}
      />
      
      <div className="fixed inset-x-4 top-[50%] translate-y-[-50%] sm:inset-x-auto sm:left-[50%] sm:-translate-x-1/2 w-auto sm:w-[500px] bg-surface rounded-2xl shadow-2xl z-[100] animate-in zoom-in-95 duration-200 overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-subtle bg-subtle/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center border border-blue-100">
              <Scale className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-[17px] font-[700] text-primary tracking-tight">Filiallararo qoldiq</h2>
              <p className="text-[13px] text-tertiary">Tumanlar bo'yicha solishtirish</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface border border-subtle flex items-center justify-center text-secondary hover:text-primary hover:bg-raised transition-all active:scale-95"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Info */}
        <div className="p-4 sm:p-5 border-b border-subtle flex items-center gap-4">
          <div className="w-[60px] h-[60px] rounded-xl bg-raised border border-subtle overflow-hidden flex items-center justify-center shrink-0 shadow-xs">
            {product.images?.[0] ? (
              <img src={product.images[0].url.replace('/upload/', '/upload/c_limit,w_150,q_auto,f_auto/')} className="w-full h-full object-cover" alt={product.artikul} />
            ) : (
              <Grid3X3 className="w-6 h-6 text-tertiary" strokeWidth={1.5} />
            )}
          </div>
          <div className="flex flex-col">
            <div className="text-[22px] font-[800] text-primary leading-tight tracking-tight">{product.artikul}</div>
            <div className="text-[12px] font-[600] text-gray-500 uppercase tracking-widest">{product.brand || 'Brendsiz'}</div>
          </div>
        </div>

        {/* List of Warehouses */}
        <div className="flex-1 overflow-y-auto bg-raised/30 p-2 sm:p-3 space-y-2">
          {isLoading ? (
            <div className="flex flex-col gap-2 p-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-[72px] bg-subtle animate-shimmer rounded-xl border border-subtle" />
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="text-center py-10 text-tertiary text-14">
              Boshqa filiallarga qoldiq topilmadi.
            </div>
          ) : (
            sortedProducts.map((p) => {
              const whId = p.warehouse?._id || p.warehouse;
              const isMyWarehouse = user?.role !== 'superadmin' && String(whId) === String(user?.warehouse?._id || user?.warehouse);
              const outOfStock = p.quantity <= 0;

              return (
                <div key={p._id} className={`bg-surface border p-3 sm:p-4 rounded-xl flex items-center justify-between gap-3 shadow-sm transition-all ${isMyWarehouse ? 'border-blue-300 bg-blue-50/50' : 'border-subtle hover:border-default'}`}>
                  
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1.5 h-10 rounded-full shrink-0" style={{ backgroundColor: p.warehouse?.color || '#cbd5e1' }} />
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[15px] font-[700] text-primary truncate">
                          {p.warehouse?.name}
                        </span>
                        {isMyWarehouse && (
                          <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shrink-0">
                            Sizning filial
                          </span>
                        )}
                      </div>
                      <div className={`text-[14px] font-[800] mt-0.5 ${outOfStock ? 'text-red-500' : 'text-emerald-600'}`}>
                        {outOfStock ? 'Qolmagan' : formatQuantity(p.quantity, p.rollLength)}
                      </div>
                    </div>
                  </div>

                  {/* Transfer / Request Buttons */}
                  <div className="shrink-0 flex items-center">
                    {isMyWarehouse ? (
                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => {
                          addToTransfer(p, 1, p.unit || 'rulon');
                          haptics.light();
                          onClose();
                        }}
                        className={`h-9 px-4 text-13 font-[600] rounded-lg active:scale-95 transition-all flex items-center gap-1.5 shadow-sm ${
                          outOfStock 
                            ? 'bg-subtle text-tertiary cursor-not-allowed border border-subtle' 
                            : 'bg-surface text-secondary border border-subtle hover:text-primary hover:bg-subtle hover:border-default'
                        }`}
                        title="Boshqa filialga yuborish uchun"
                      >
                        <Package className="w-4 h-4" />
                        <span className="hidden sm:inline">Yuborish</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={outOfStock}
                        onClick={() => {
                          addToTransfer(p, 1, p.unit || 'rulon');
                          haptics.light();
                          onClose(); // Option: keep it open or close it? Close it implies they can proceed to transfer drawer.
                        }}
                        className={`h-9 px-4 text-13 font-[600] rounded-lg active:scale-95 transition-all flex items-center gap-1.5 shadow-sm ${
                          outOfStock 
                            ? 'bg-subtle text-tertiary cursor-not-allowed border border-subtle' 
                            : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-[0_4px_12px_rgba(37,99,235,0.2)]'
                        }`}
                      >
                        <Send className="w-4 h-4" />
                        <span className="hidden sm:inline">So'rash</span>
                        <span className="sm:hidden">So'rov</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};

export default CompareModal;
