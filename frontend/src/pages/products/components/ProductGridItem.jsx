import React from 'react';
import { Eye, ShoppingBag, Minus, Plus, Package, MoreHorizontal, Pencil, Trash2, Send, Grid3X3, Scale } from 'lucide-react';
import { FaFire, FaSnowflake } from 'react-icons/fa6';
import { formatUZS, formatQuantity } from '../../../utils/format';
import { haptics } from '../../../utils/haptics';
import toast from 'react-hot-toast';

const ProductGridItem = React.forwardRef(({
  product,
  user,
  cartUnits,
  cartQuantities,
  getRemainingStock,
  cartWarehouse,
  setConfirmWarehouseSwitch,
  addToCart,
  addToTransfer,
  handleQtyChange,
  setViewerImages,
  toggleDropdown,
  openDropdownId,
  setOpenDropdownId,
  openEditModal,
  handleDelete,
  clearSearch,
  openCompareModal
}, ref) => {
  const gridUnit = cartUnits[product._id] || product.unit || 'rulon';
  const gridRemaining = getRemainingStock(product, gridUnit);
  const gridQty = gridRemaining <= 0 ? 0 : Math.min(cartQuantities[product._id] || 1, gridRemaining);
  const gridOutOfStock = (product.quantity || 0) <= 0;
  const gridCartMax = !gridOutOfStock && gridRemaining <= 0;

  // ===== LYUSTRA MAXSUS UI =====
  if (product.category === 'lyustra') {
    return (
      <div 
        ref={ref} 
        className="relative bg-gray-900 rounded-2xl overflow-hidden aspect-[3/4] cursor-pointer group transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_16px_32px_-8px_rgba(0,0,0,0.2)] shadow-md select-none"
        onClick={() => {
          if (product.images && product.images.length > 0) setViewerImages(product.images);
        }}
      >
        {/* Rasm */}
        {product.images && product.images.length > 0 ? (
          <img 
            src={product.images[0].url.replace('/upload/', '/upload/c_limit,w_600,q_auto,f_auto/')} 
            loading="lazy" 
            alt={product.artikul} 
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <Grid3X3 className="w-12 h-12 text-gray-300" />
          </div>
        )}

        {/* Top-Left: Ko'k Birka (Narx va Miqdor) */}
        <div className="absolute top-2 sm:top-3 left-2 sm:left-3 bg-[#0010c2] text-white flex flex-col items-start px-1.5 sm:px-2 py-1 sm:py-1.5 rounded shadow-lg z-20 transition-transform group-hover:scale-105 origin-top-left">
          <span className="text-[11px] sm:text-[14px] font-[800] leading-tight tracking-tight">
            {product.quantity} {product.unit || 'dona'}
          </span>
          <span className="text-[11px] sm:text-[14px] font-[800] leading-tight tracking-tight mt-0.5">
            {formatUZS(product.pricePerRoll || product.wholesalePrice).replace(" so'm", "")} uzs
          </span>
        </div>

        {/* Top-Right: Glassmorphism tugmalar (Edit, Transfer, Delete) */}
        {(!user || user.role === 'superadmin' || String(product.warehouse?._id || product.warehouse) === String(user?.warehouse?._id || user?.warehouse)) && (
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3 flex flex-col gap-1.5 sm:gap-2 z-20">
            <button 
              onClick={(e) => { e.stopPropagation(); openCompareModal(product); }} 
              className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white hover:bg-black/50 transition-all border border-white/10"
              title="Solishtirish"
            >
              <Scale className="w-[13px] h-[13px] sm:w-[15px] sm:h-[15px]" />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); addToTransfer(product, 1, product.unit || 'rulon'); }} 
              className="flex w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-black/30 backdrop-blur-md items-center justify-center text-white/90 hover:text-white hover:bg-black/50 transition-all border border-white/10"
              title="Boshqa filialga"
            >
              <Package className="w-[13px] h-[13px] sm:w-[15px] sm:h-[15px]" />
            </button>
            <div className="relative">
              <button 
                onClick={(e) => { e.stopPropagation(); toggleDropdown(product._id); }} 
                className="w-7 h-7 sm:w-9 sm:h-9 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white hover:bg-black/50 transition-all border border-white/10"
                title="Boshqa amallar"
              >
                <MoreHorizontal className="w-[14px] h-[14px] sm:w-[16px] sm:h-[16px]" />
              </button>
              {openDropdownId === product._id && (
                <>
                  <div className="fixed inset-0 z-30" onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); }}></div>
                  <div className="absolute right-0 top-full mt-1.5 w-[180px] bg-surface border border-subtle rounded-xl shadow-2xl z-40 py-1.5 overflow-hidden" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { openEditModal(product); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-13 text-primary hover:bg-subtle flex items-center gap-2.5 transition-colors">
                      <Pencil className="w-[15px] h-[15px] text-tertiary" /> Tahrirlash
                    </button>
                    <div className="h-px bg-subtle my-1 w-full" />
                    <button onClick={() => { handleDelete(product._id); setOpenDropdownId(null); }} className="w-full text-left px-4 py-2 text-13 text-state-danger-text hover:bg-state-danger-bg flex items-center gap-2.5 transition-colors">
                      <Trash2 className="w-[15px] h-[15px]" /> O'chirish
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Bottom: Gradient va Savdo boshqaruvi */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-12 sm:pt-16 pb-2.5 sm:pb-4 px-2.5 sm:px-4 z-10 flex flex-col justify-end pointer-events-auto">
          {/* Sklad nomi (badge) */}
          {product.warehouse && (
            <div className="flex items-center gap-1.5 mb-1.5 sm:mb-2 opacity-80">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: product.warehouse.color || '#fff' }}></span>
              <span className="text-[9px] sm:text-[11px] font-[600] text-white uppercase tracking-wider">{product.warehouse.name}</span>
            </div>
          )}

          {/* Mahsulot Nomi */}
          <div className="text-white text-[13px] sm:text-[17px] font-[700] tracking-tight leading-snug mb-2 sm:mb-4 line-clamp-2 drop-shadow-md">
            {product.brand || product.artikul} {product.brand && product.artikul !== product.brand ? `— ${product.artikul}` : ''}
          </div>
          
          {/* Controls: - 1 + va Savatga */}
          <div className="flex gap-1.5 sm:gap-2 items-center w-full" onClick={e => e.stopPropagation()}>
            <div className="flex items-center bg-white/20 backdrop-blur-md border border-white/10 rounded-lg sm:rounded-xl h-8 sm:h-10 p-0.5 sm:p-1 shrink-0">
              <button
                type="button"
                disabled={gridRemaining <= 0 || gridQty <= 1}
                onClick={() => handleQtyChange(product._id, gridQty - 1, gridRemaining)}
                className="w-6 sm:w-8 h-full flex items-center justify-center text-white disabled:opacity-30 active:scale-90 transition-transform"
              >
                <Minus className="w-[12px] h-[12px] sm:w-[14px] sm:h-[14px]" strokeWidth={2.5} />
              </button>
              <input
                type="number"
                disabled={gridRemaining <= 0}
                value={gridQty}
                onChange={(e) => handleQtyChange(product._id, parseInt(e.target.value) || 1, gridRemaining)}
                className="w-6 sm:w-8 h-full text-center text-[12px] sm:text-[14px] bg-transparent border-0 outline-none text-white font-[700] p-0"
              />
              <button
                type="button"
                disabled={gridRemaining <= 0 || gridQty >= gridRemaining}
                onClick={() => handleQtyChange(product._id, gridQty + 1, gridRemaining)}
                className="w-6 sm:w-8 h-full flex items-center justify-center text-white disabled:opacity-30 active:scale-90 transition-transform"
              >
                <Plus className="w-[12px] h-[12px] sm:w-[14px] sm:h-[14px]" strokeWidth={2.5} />
              </button>
            </div>
            
            {user?.role !== 'superadmin' && String(product.warehouse?._id || product.warehouse) !== String(user?.warehouse?._id || user?.warehouse) ? (
              <button
                type="button"
                disabled={gridRemaining <= 0}
                onClick={() => {
                  addToTransfer(product, gridQty, gridUnit);
                  haptics.light();
                }}
                className="flex-1 h-8 sm:h-10 text-[11px] sm:text-[13px] font-[700] rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 bg-[#2563eb] text-white hover:bg-[#1d4ed8] disabled:opacity-50 disabled:bg-white/20 active:scale-[0.97] transition-all shadow-lg border border-transparent"
              >
                <Send className="w-[12px] h-[12px] sm:w-[14px] sm:h-[14px]" />
                <span className="hidden sm:inline">{gridOutOfStock ? "Yo'q" : "So'rov"}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={gridRemaining <= 0}
                onClick={() => {
                  const quantity = gridQty;
                  const unit = gridUnit;
                  const prodWarehouseId = product.warehouse?._id || product.warehouse;
                  if (cartWarehouse && cartWarehouse !== prodWarehouseId) {
                    setConfirmWarehouseSwitch({ product, quantity, unit });
                  } else {
                    const added = addToCart(product, quantity, unit);
                    if (added === true) {
                      toast.success(`${product.brand || product.artikul} savatga qo'shildi!`);
                      clearSearch();
                      haptics.light();
                    }
                  }
                }}
                className="flex-1 h-8 sm:h-10 text-[11px] sm:text-[13px] font-[700] rounded-lg sm:rounded-xl flex items-center justify-center gap-1 sm:gap-2 bg-white text-black hover:bg-gray-100 disabled:opacity-50 disabled:bg-white/20 disabled:text-white active:scale-[0.97] transition-all shadow-lg"
              >
                <ShoppingBag className="w-[12px] h-[12px] sm:w-[14px] sm:h-[14px]" />
                {gridOutOfStock ? "Yo'q" : gridCartMax ? "Maks" : "Savatga"}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== BOSHQA MAHSULOTLAR UCHUN STANDARD UI =====
  return (
    <div ref={ref} className="bg-surface border border-subtle rounded-2xl flex flex-col relative overflow-hidden transition-all duration-300 hover:shadow-[0_12px_24px_-4px_rgba(0,0,0,0.08),0_4px_8px_-2px_rgba(0,0,0,0.04)] hover:-translate-y-1 hover:border-slate-300/80 group cursor-pointer">
      {product.warehouse?.color && (
        <div className="absolute top-0 left-0 right-0 h-1.5 z-10" style={{ backgroundColor: product.warehouse.color }}></div>
      )}

      {/* Top-Right: Glassmorphism actions (OUTSIDE image box to prevent clipping) */}
      {(!user || user.role === 'superadmin' || String(product.warehouse?._id || product.warehouse) === String(user?.warehouse?._id || user?.warehouse)) && (
        <div className="absolute top-2 sm:top-2 right-2 sm:right-2 flex flex-col gap-1.5 z-30">
          <button 
            onClick={(e) => { e.stopPropagation(); openCompareModal(product); }} 
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white hover:bg-black/50 transition-all border border-white/10"
            title="Solishtirish"
          >
            <Scale className="w-[13px] h-[13px] sm:w-[14px] sm:h-[14px]" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); addToTransfer(product, 1, product.unit || 'rulon'); }} 
            className="flex w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/30 backdrop-blur-md items-center justify-center text-white/90 hover:text-white hover:bg-black/50 transition-all border border-white/10"
            title="Boshqa filialga"
          >
            <Package className="w-[13px] h-[13px] sm:w-[14px] sm:h-[14px]" />
          </button>
          <div className="relative">
            <button 
              onClick={(e) => { e.stopPropagation(); toggleDropdown(product._id); }} 
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white/90 hover:text-white hover:bg-black/50 transition-all border border-white/10"
              title="Boshqa amallar"
            >
              <MoreHorizontal className="w-[14px] h-[14px]" />
            </button>
            {openDropdownId === product._id && (
              <>
                <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpenDropdownId(null); }}></div>
                <div className="absolute right-0 top-full mt-1.5 w-[160px] bg-surface border border-subtle rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { openEditModal(product); setOpenDropdownId(null); }} className="w-full text-left px-3 py-2 text-[12px] font-[600] text-primary hover:bg-subtle flex items-center gap-2 transition-colors">
                    <Pencil className="w-[13px] h-[13px] text-tertiary" strokeWidth={2} /> Tahrirlash
                  </button>
                  <div className="h-px bg-subtle my-1 w-full" />
                  <button onClick={() => { handleDelete(product._id); setOpenDropdownId(null); }} className="w-full text-left px-3 py-2 text-[12px] font-[600] text-state-danger-text hover:bg-state-danger-bg flex items-center gap-2 transition-colors">
                    <Trash2 className="w-[13px] h-[13px]" strokeWidth={2} /> O'chirish
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div 
        className="relative h-[120px] sm:h-[160px] bg-subtle overflow-hidden flex items-center justify-center cursor-pointer transition-opacity group/img"
        onClick={(e) => {
          e.stopPropagation();
          if (product.images && product.images.length > 0) setViewerImages(product.images);
        }}
      >
        <div className="absolute top-2 left-2 z-20 flex flex-col gap-1.5">
          {((product.soldQuantity || 0) >= 50 || ((product.quantity || 0) > 0 && (product.quantity || 0) <= (product.minStock || 4))) && (
            <div className="bg-orange-50 text-orange-600 border border-orange-200 text-[10px] font-[800] px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
              <FaFire className="w-3 h-3 text-orange-500 fill-orange-500 shrink-0" /> {((product.quantity || 0) > 0 && (product.quantity || 0) <= (product.minStock || 4)) ? 'TUGAYAPTI' : 'TOP'}
            </div>
          )}
          {(product.soldQuantity || 0) === 0 && (product.quantity || 0) > (product.minStock || 4) && (
            <div className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] font-[800] px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
              <FaSnowflake className="w-3 h-3 text-blue-500 shrink-0" /> PASSIV
            </div>
          )}
        </div>
        {product.images && product.images.length > 0 ? (
          <>
            <img src={product.images[0].url.replace('/upload/', '/upload/c_limit,w_400,q_auto,f_auto/')} loading="lazy" alt={product.brand || product.artikul} className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110" />
            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10 backdrop-blur-sm">
              <div className="bg-white/30 p-2.5 rounded-full text-white shadow-lg backdrop-blur-md transform scale-90 group-hover/img:scale-100 transition-transform duration-300">
                <Eye className="w-6 h-6" />
              </div>
            </div>
          </>
        ) : (
          <Grid3X3 className="w-[24px] h-[24px] text-tertiary" strokeWidth={1.5} />
        )}

        {product.warehouse && (
          <div className="absolute bottom-2 left-2 bg-overlay/80 backdrop-blur-sm border border-subtle px-1.5 py-0.5 sm:px-2 sm:py-1 rounded flex items-center gap-1 sm:gap-1.5 shadow-sm z-20">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full" style={{ backgroundColor: product.warehouse.color || '#D4D1CC' }}></span>
            <span className="text-[9px] sm:text-[11px] font-[700] text-primary">{product.warehouse.name}</span>
          </div>
        )}
      </div>
      
      <div className="p-2 sm:p-3 flex-1 flex flex-col">
        {/* Row 1: Artikul & Qty */}
        <div className="flex items-start justify-between gap-1 mb-0.5 sm:mb-1">
          <div className="text-[14px] sm:text-[18px] font-[800] text-primary tracking-tight leading-none truncate">{product.artikul}</div>
          <div className={`text-[11px] sm:text-[13px] font-[800] whitespace-nowrap leading-none ${product.quantity <= product.minStock ? 'text-red-600' : 'text-emerald-600'}`}>
            {product.quantity} {product.unit || 'rulon'}
          </div>
        </div>
        
        {/* Row 2: Brand & Polka */}
        <div className="flex items-center justify-between text-[9px] sm:text-[11px] text-tertiary mb-1.5 sm:mb-2">
          <span className="font-[700] uppercase tracking-wider truncate max-w-[60%]">{product.brand || 'Brendsiz'}</span>
          <span className="font-[500] truncate">Polka: {product.polka || '—'}</span>
        </div>
        
        {/* Row 3: Price */}
        <div className="mt-auto mb-2 flex items-baseline gap-1">
          <span className="text-[15px] sm:text-[18px] font-[800] text-primary tracking-tight leading-none">{formatUZS(product.pricePerRoll || product.wholesalePrice).replace(" so'm", "")}</span>
          <span className="text-[9px] sm:text-[11px] font-[700] text-gray-500 uppercase">UZS</span>
        </div>

        {/* Row 4: Counter and Cart */}
        <div className="flex gap-1.5 sm:gap-2 items-stretch w-full">
            <div className="flex flex-1 items-center justify-between bg-subtle/50 border border-subtle rounded-[8px] sm:rounded-[10px] h-8 sm:h-10 p-0.5 sm:p-1 shadow-inner select-none min-w-[90px]">
              <button
                type="button"
                disabled={gridRemaining <= 0 || gridQty <= 1}
                onClick={() => handleQtyChange(product._id, gridQty - 1, gridRemaining)}
                className="w-7 sm:w-8 shrink-0 h-full rounded-[6px] sm:rounded-[8px] flex items-center justify-center text-secondary hover:text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all duration-200 ease-out cursor-pointer bg-surface/50 border border-transparent hover:border-subtle hover:shadow-sm"
              >
                <Minus className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={2.5} />
              </button>
              <input
                type="number"
                disabled={gridRemaining <= 0}
                value={gridQty}
                onChange={(e) => handleQtyChange(product._id, parseInt(e.target.value) || 1, gridRemaining)}
                className="w-6 sm:w-10 flex-1 h-full text-center text-[12px] sm:text-[14px] bg-transparent border-0 outline-none text-primary font-[600] font-mono focus:ring-0 disabled:opacity-40 disabled:cursor-not-allowed [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                disabled={gridRemaining <= 0 || gridQty >= gridRemaining}
                onClick={() => handleQtyChange(product._id, gridQty + 1, gridRemaining)}
                className="w-7 sm:w-8 shrink-0 h-full rounded-[6px] sm:rounded-[8px] flex items-center justify-center text-secondary hover:text-primary hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all cursor-pointer bg-surface/50 border border-transparent hover:border-subtle"
              >
                <Plus className="w-3 h-3 sm:w-4 sm:h-4" strokeWidth={2.5} />
              </button>
            </div>
            
            {user?.role !== 'superadmin' && String(product.warehouse?._id || product.warehouse) !== String(user?.warehouse?._id || user?.warehouse) ? (
              <button
                type="button"
                disabled={gridRemaining <= 0}
                onClick={() => {
                  addToTransfer(product, gridQty, gridUnit);
                  haptics.light();
                }}
                className={`w-[32px] sm:flex-1 sm:w-auto h-8 sm:h-10 text-[11px] sm:text-[13px] font-[600] rounded-[8px] sm:rounded-[10px] active:scale-[0.96] transition-all duration-300 ease-out flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 ${
                  gridRemaining <= 0 
                    ? 'bg-subtle text-tertiary cursor-not-allowed border border-subtle' 
                    : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-[0_4px_12px_rgba(37,99,235,0.2)]'
                }`}
                title="So'rov yuborish"
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{gridOutOfStock ? "Yo'q" : "So'rov"}</span>
              </button>
            ) : (
            <button
              type="button"
              disabled={gridRemaining <= 0}
              onClick={() => {
                const quantity = gridQty;
                const unit = gridUnit;
                const prodWarehouseId = product.warehouse?._id || product.warehouse;
                
                if (cartWarehouse && cartWarehouse !== prodWarehouseId) {
                  setConfirmWarehouseSwitch({ product, quantity, unit });
                } else {
                  const added = addToCart(product, quantity, unit);
                  if (added === true) {
                    toast.success(`${product.brand || product.artikul} (${quantity} ${unit}) savatga qo'shildi!`);
                    clearSearch();
                  }
                }
              }}
              className={`w-[32px] sm:flex-1 sm:w-auto h-8 sm:h-10 text-[11px] sm:text-[13px] font-[600] rounded-[8px] sm:rounded-[10px] active:scale-[0.96] transition-all duration-300 ease-out flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer shrink-0 ${
                gridRemaining <= 0 
                  ? 'bg-subtle text-tertiary cursor-not-allowed border border-subtle' 
                  : 'bg-accent text-inverse hover:bg-accent-hover shadow-sm hover:shadow-[0_4px_12px_rgba(0,0,0,0.15)] hover:-translate-y-0.5'
              }`}
              title="Savatga qo'shish"
            >
              <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{gridOutOfStock ? "Yo'q" : gridCartMax ? "Maks" : "Savatga"}</span>
            </button>
            )}
        </div>
      </div>
  </div>
  );
});

export default ProductGridItem;
