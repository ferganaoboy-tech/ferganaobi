import React from 'react';
import { Eye, ShoppingBag, Package, Pencil, Trash2, Send, Grid3X3, MoreHorizontal, Minus, Plus, Scale } from 'lucide-react';
import { FaFire, FaSnowflake } from 'react-icons/fa6';
import { formatUZS, formatQuantity } from '../../../utils/format';
import { haptics } from '../../../utils/haptics';
import toast from 'react-hot-toast';

const ProductTableMobileRow = React.forwardRef(({
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
  const mobileUnit = cartUnits[product._id] || product.unit || 'rulon';
  const mobileRemaining = getRemainingStock(product, mobileUnit);
  const rawQty = cartQuantities[product._id];
  const mobileQty = mobileRemaining <= 0 ? 0 : (rawQty !== undefined ? (rawQty === '' ? '' : Math.min(rawQty, mobileRemaining)) : 1);
  const mobileOutOfStock = (product.quantity || 0) <= 0;
  const mobileCartMax = !mobileOutOfStock && mobileRemaining <= 0;

  return (
    <div
      ref={ref}
      className="relative flex flex-col bg-surface hover:bg-subtle/30 transition-colors py-3"
    >
      {/* Warehouse color stripe */}
      {product.warehouse?.color && (
        <div className="absolute left-0 top-0 bottom-0 w-[4px] z-10" style={{ backgroundColor: product.warehouse.color }} />
      )}

      {/* Top half: Data Row */}
      <div className="pl-4 pr-[70px] relative flex items-center gap-3 min-h-[60px]">
        
        {/* Menu (Vertical Top Right) */}
        <div className="absolute top-1.5 right-2 flex items-center gap-0.5">
          <button
            onClick={() => toggleDropdown(`mobile-${product._id}`)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-primary hover:bg-subtle active:scale-95 transition-all"
          >
            <MoreHorizontal className="w-5 h-5" />
          </button>
          {openDropdownId === `mobile-${product._id}` && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpenDropdownId(null)} />
              <div className="absolute right-0 top-8 w-[140px] bg-surface border border-subtle rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                <button onClick={() => openEditModal(product)} className="w-full text-left px-3 py-2 text-[13px] font-[500] text-secondary hover:bg-subtle flex items-center gap-2">
                  <Pencil className="w-3.5 h-3.5 text-tertiary" strokeWidth={1.5} /> Tahrirlash
                </button>
                <button onClick={() => handleDelete(product._id)} className="w-full text-left px-3 py-2 text-[13px] font-[500] text-red-600 hover:bg-state-danger-bg flex items-center gap-2">
                  <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} /> O'chirish
                </button>
              </div>
            </>
          )}
        </div>

        {/* Image */}
        <div 
          className="relative w-[52px] h-[52px] rounded-lg border border-subtle bg-raised shrink-0 overflow-hidden flex items-center justify-center shadow-xs cursor-pointer group/img"
          onClick={(e) => {
            e.stopPropagation();
            if (product.images && product.images.length > 0) setViewerImages(product.images);
          }}
        >
          {product.images?.[0] ? (
            <>
              <img src={product.images[0].url} className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110" alt={product.brand} />
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10 backdrop-blur-[1px]">
                <div className="bg-white/30 p-1 rounded-full text-white backdrop-blur-md transform scale-90 group-hover/img:scale-100 transition-transform duration-300">
                  <Eye className="w-4 h-4" />
                </div>
              </div>
            </>
          ) : (
            <Grid3X3 className="w-5 h-5 text-tertiary" strokeWidth={1.5} />
          )}
        </div>

        {/* Info (Flex Row: Left - Artikul/Brand | Right - Price/Stock) */}
        <div className="flex flex-1 items-center justify-between min-w-0 gap-2">
          {/* Left: Artikul & Brand */}
          <div className="flex flex-col min-w-0">
             <div className="flex items-center gap-2 mb-1.5">
               <div className="text-[17px] font-[700] text-primary leading-none truncate">{product.artikul}</div>
               <button 
                  onClick={(e) => { e.stopPropagation(); openCompareModal(product); }}
                  className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 hover:text-blue-700 active:scale-95 transition-all shrink-0"
                  title="Boshqa filiallardagi qoldiqni ko'rish"
                >
                  <Scale className="w-3.5 h-3.5" />
                </button>
               {((product.soldQuantity || 0) >= 50 || ((product.quantity || 0) > 0 && (product.quantity || 0) <= (product.minStock || 4))) && (
                 <span title={((product.quantity || 0) > 0 && (product.quantity || 0) <= (product.minStock || 4)) ? "Tugayapti" : "Ko'p sotilayotgan (TOP)"} className="inline-flex items-center text-orange-500 drop-shadow-sm shrink-0">
                   <FaFire className="w-4 h-4 fill-current" />
                 </span>
               )}
               {(product.soldQuantity || 0) === 0 && (product.quantity || 0) > (product.minStock || 4) && (
                 <span title="Sotilmayotgan passiv zaxira" className="inline-flex items-center text-blue-500 drop-shadow-sm shrink-0">
                   <FaSnowflake className="w-4 h-4 fill-current" />
                 </span>
               )}
             </div>
             <div className="text-[11px] font-[600] text-gray-500 uppercase tracking-widest leading-none truncate">{product.brand || 'Brendsiz'}</div>
          </div>

          {/* Right: Price & Stock */}
          <div className="flex flex-col items-end shrink-0">
            <div className="flex items-baseline gap-1 mb-1.5">
              <span className="text-[16px] font-[700] text-primary leading-none">{formatUZS(product.pricePerRoll || product.wholesalePrice).replace(" so'm", "")}</span>
              <span className="text-[10px] font-[600] text-gray-500">UZS</span>
            </div>
            <div className={`text-[14px] font-[700] leading-none ${product.quantity <= product.minStock ? 'text-red-600' : 'text-emerald-600'}`}>
              {product.quantity} {product.unit || 'rulon'}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom controls row */}
      <div className="pl-4 pr-3 mt-3 flex items-center justify-between gap-2">
        
        {/* Qty counter */}
        <div className="w-[96px] shrink-0 flex items-center bg-subtle border border-subtle rounded-lg h-8 overflow-hidden justify-between">
          <button
            type="button"
            disabled={mobileRemaining <= 0 || mobileQty <= 1}
            onClick={() => handleQtyChange(product._id, mobileQty - 1, mobileRemaining)}
            className="w-8 h-full flex items-center justify-center text-secondary hover:text-primary active:bg-raised transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Minus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
          <input
            type="number"
            disabled={mobileRemaining <= 0}
            value={mobileQty}
            onChange={(e) => {
              const val = e.target.value;
              handleQtyChange(product._id, val === '' ? '' : parseInt(val) || 0, mobileRemaining);
            }}
            className="flex-1 w-full text-center text-[13px] font-[700] text-primary font-mono bg-transparent border-0 outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            disabled={mobileRemaining <= 0 || (mobileQty !== '' && mobileQty >= mobileRemaining)}
            onClick={() => handleQtyChange(product._id, (parseInt(mobileQty) || 0) + 1, mobileRemaining)}
            className="w-8 h-full flex items-center justify-center text-secondary active:bg-subtle transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex-1 flex items-center gap-2 min-w-0">
          {user?.role !== 'superadmin' && String(product.warehouse?._id || product.warehouse) !== String(user?.warehouse?._id || user?.warehouse) ? (
            <button
              type="button"
              disabled={mobileRemaining <= 0 || mobileQty === '' || mobileQty <= 0}
              onClick={() => {
                addToTransfer(product, mobileQty, mobileUnit);
                haptics.light();
              }}
              className={`flex-1 h-8 text-[12px] font-[600] rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs px-1 ${
                mobileRemaining <= 0 
                  ? 'bg-subtle text-tertiary cursor-not-allowed border border-subtle' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              title="Filialdan so'rash"
            >
              <Send className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
              <span className="truncate">{mobileOutOfStock ? "Skladda yo'q" : "So'rov yuborish"}</span>
            </button>
          ) : (
            <>
              {/* Boshqa filialga (Transfer) */}
              <button
                type="button"
                disabled={mobileRemaining <= 0 || mobileQty === '' || mobileQty <= 0}
                onClick={() => {
                  addToTransfer(product, mobileQty, mobileUnit);
                  haptics.light();
                }}
                className={`flex-1 h-8 text-[12px] font-[600] rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs px-1 ${
                  mobileRemaining <= 0 
                    ? 'bg-subtle text-tertiary cursor-not-allowed border border-subtle' 
                    : 'bg-surface text-secondary border border-subtle hover:bg-subtle hover:text-primary hover:border-default'
                }`}
                title="Boshqa filialga o'tkazish"
              >
                <Package className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                <span className="truncate">Filialga</span>
              </button>

              {/* Savatga */}
              <button
                type="button"
                disabled={mobileRemaining <= 0 || mobileQty === '' || mobileQty <= 0}
                onClick={() => {
                  const quantity = mobileQty;
                  const unit = mobileUnit;
                  const prodWarehouseId = product.warehouse?._id || product.warehouse;
                  
                  if (cartWarehouse && cartWarehouse !== prodWarehouseId) {
                    setConfirmWarehouseSwitch({ product, quantity, unit });
                  } else {
                    const added = addToCart(product, quantity, unit);
                    if (added === true) {
                      haptics.light();
                      toast.success(`${product.brand || product.artikul} (${quantity} ${unit}) savatga qo'shildi!`);
                      clearSearch();
                    }
                  }
                }}
                className={`flex-1 h-8 text-[12px] font-[600] rounded-lg flex items-center justify-center gap-1.5 active:scale-95 transition-all shadow-xs px-1 ${
                  mobileRemaining <= 0 
                    ? 'bg-subtle text-tertiary cursor-not-allowed border border-subtle' 
                    : 'bg-accent text-inverse hover:bg-accent-hover'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                <span className="truncate">{mobileOutOfStock ? "Skladda yo'q" : mobileCartMax ? "Savatda(Maks)" : "Savatga"}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default ProductTableMobileRow;
