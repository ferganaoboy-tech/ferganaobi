import React from 'react';
import { Eye, ShoppingBag, Package, Pencil, Trash2, Grid3X3, Send, Scale } from 'lucide-react';
import { formatUZS, formatQuantity } from '../../../utils/format';
import { haptics } from '../../../utils/haptics';
import toast from 'react-hot-toast';

const ProductTableDesktopRow = React.forwardRef(({
  product,
  user,
  cartUnits,
  cartQuantities,
  getRemainingStock,
  cartWarehouse,
  setConfirmWarehouseSwitch,
  addToCart,
  addToTransfer,
  setViewerImages,
  openEditModal,
  handleDelete,
  clearSearch,
  openCompareModal
}, ref) => {
  const tableUnit = cartUnits[product._id] || product.unit || 'rulon';
  const tableRemaining = getRemainingStock(product, tableUnit);
  const tableQty = tableRemaining <= 0 ? 0 : Math.min(cartQuantities[product._id] || 1, tableRemaining);
  const tableOutOfStock = (product.quantity || 0) <= 0;
  const tableCartMax = !tableOutOfStock && tableRemaining <= 0;

  return (
    <tr ref={ref} className="border-b border-subtle hover:bg-subtle group h-[48px] relative">
      <td className="pl-4 pr-3 relative">
        {product.warehouse?.color && (
          <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: product.warehouse.color }}></div>
        )}
        <div className="flex items-center gap-3">
          <div 
            className="relative w-8 h-8 rounded bg-raised border border-subtle overflow-hidden shrink-0 cursor-pointer group/img"
            onClick={(e) => {
              e.stopPropagation();
              if (product.images && product.images.length > 0) setViewerImages(product.images);
            }}
          >
            {product.images?.[0] ? (
              <>
                <img src={product.images[0].url.replace('/upload/', '/upload/c_limit,w_100,q_auto,f_auto/')} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110" />
                <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10 backdrop-blur-[1px]">
                  <div className="bg-white/30 p-0.5 rounded-full text-white backdrop-blur-md transform scale-90 group-hover/img:scale-100 transition-transform duration-300">
                    <Eye className="w-3 h-3" />
                  </div>
                </div>
              </>
            ) : (
              <Grid3X3 className="w-[14px] h-[14px] m-[9px] text-tertiary" strokeWidth={1.5} />
            )}
          </div>
          <div className="min-w-0 flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <div className="text-[15px] font-[700] text-primary tracking-tight">{product.artikul}</div>
              <button 
                onClick={(e) => { e.stopPropagation(); openCompareModal(product); }}
                className="w-6 h-6 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 hover:bg-blue-100 hover:text-blue-700 active:scale-95 transition-all shrink-0"
                title="Boshqa filiallardagi qoldiqni ko'rish"
              >
                <Scale className="w-3 h-3" />
              </button>
            </div>
            <div className="font-[500] text-gray-400 text-[11px] uppercase tracking-widest truncate">{product.brand || 'Brendsiz'}</div>
          </div>
        </div>
      </td>
      <td className="px-3 text-secondary">
        {product.warehouse?.name}
      </td>
      <td className="px-3 text-tertiary text-12">
        <span className="font-mono bg-subtle px-2 py-0.5 rounded">{product.polka || 'Yo\'q'}</span>
      </td>
      <td className="px-3 text-right">
        <div className="flex items-baseline justify-end gap-1" title="Sotuv narxi">
          <span className="text-[14px] font-[600] text-primary tracking-tight">{formatUZS(product.pricePerRoll || product.wholesalePrice).replace(" so'm", "")}</span>
          <span className="text-[10px] font-[500] text-gray-500">UZS</span>
        </div>
      </td>
      <td className="px-3 text-right">
        {product.quantity <= product.minStock ? (
           <span className="inline-flex items-center gap-1.5 bg-surface border border-subtle px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
             <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
             <span className="text-[13px] font-[600] text-primary">{product.quantity} {product.unit || 'rulon'}</span>
           </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 bg-surface border border-subtle px-2 py-1 rounded-md shadow-sm whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-[13px] font-[600] text-primary">{product.quantity} {product.unit || 'rulon'}</span>
          </span>
        )}
      </td>
      <td className="px-3 align-middle text-center">
        <div className="flex items-center justify-center">
          {user?.role !== 'superadmin' && String(product.warehouse?._id || product.warehouse) !== String(user?.warehouse?._id || user?.warehouse) ? (
            <button
              type="button"
              disabled={tableRemaining <= 0}
              onClick={() => {
                addToTransfer(product, tableQty, tableUnit);
                haptics.light();
              }}
              className={`w-7 h-7 rounded active:scale-95 transition-all flex items-center justify-center ${
                tableRemaining <= 0 
                  ? 'bg-subtle text-tertiary cursor-not-allowed border border-subtle' 
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
              title={tableOutOfStock ? "Skladda yo'q" : "So'rov yuborish"}
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          ) : (
          <button
            type="button"
            disabled={tableRemaining <= 0}
            onClick={() => {
              const quantity = tableQty;
              const unit = tableUnit;
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
            className={`w-7 h-7 rounded active:scale-95 transition-all flex items-center justify-center ${
              tableRemaining <= 0 
                ? 'bg-subtle text-tertiary cursor-not-allowed border border-subtle' 
                : 'bg-accent text-inverse hover:bg-accent-hover'
            }`}
            title={tableOutOfStock ? "Skladda yo'q" : tableCartMax ? "Savatda (Maks)" : "Savatga qo'shish"}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
          </button>
          )}
        </div>
      </td>
      <td className="pl-3 pr-4 text-right align-middle">
        {(!user || user.role === 'superadmin' || String(product.warehouse?._id || product.warehouse) === String(user?.warehouse?._id || user?.warehouse)) && (
          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100">
            <button onClick={() => { addToTransfer(product, 1, product.unit || 'rulon'); }} className="w-[28px] h-[28px] flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded" title="Boshqa filialga ko'chirish"><Package className="w-[14px] h-[14px]" strokeWidth={1.5} /></button>
            <button onClick={() => openEditModal(product)} className="w-[28px] h-[28px] flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded" title="Tahrirlash"><Pencil className="w-[14px] h-[14px]" strokeWidth={1.5} /></button>
            <button onClick={() => handleDelete(product._id)} className="w-[28px] h-[28px] flex items-center justify-center text-secondary hover:text-state-danger-text hover:bg-state-danger-bg rounded" title="O'chirish"><Trash2 className="w-[14px] h-[14px]" strokeWidth={1.5} /></button>
          </div>
        )}
      </td>
    </tr>
  );
});

export default ProductTableDesktopRow;
