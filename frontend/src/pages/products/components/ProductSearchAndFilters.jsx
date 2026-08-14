import React from 'react';
import { Search, SlidersHorizontal, Grid3X3, Eye, ShoppingBag, ArrowUp, ArrowDown, LayoutGrid, List } from 'lucide-react';
import { formatUZS, formatQuantity } from '../../../utils/format';
import toast from 'react-hot-toast';
import { haptics } from '../../../utils/haptics';

const ProductSearchAndFilters = ({
  searchRef,
  inputRef,
  searchInput,
  setSearchInput,
  handleFilterChange,
  isSearchFocused,
  setIsSearchFocused,
  keyboardMode,
  setKeyboardMode,
  filters,
  setFilters,
  products,
  setViewerImages,
  cartUnits,
  getRemainingStock,
  cartQuantities,
  cartWarehouse,
  setConfirmWarehouseSwitch,
  addToCart,
  clearSearch,
  showMobileFilters,
  setShowMobileFilters,
  viewMode,
  setViewMode
}) => {
  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center mb-4 shrink-0 w-full">
      {/* Search Input */}
      <div className="relative w-full sm:flex-1" ref={searchRef}>
        <Search className="w-4 h-4 text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
        <input 
          ref={inputRef}
          name="search"
          inputMode={keyboardMode || 'none'}
          value={searchInput}
          onChange={handleFilterChange}
          onFocus={() => setIsSearchFocused(true)}
          onClick={(e) => {
            if (keyboardMode === 'none') {
              setKeyboardMode('search');
              // Blur and refocus to force virtual keyboard to appear on mobile
              if (document.activeElement === inputRef.current) {
                inputRef.current.blur();
                setTimeout(() => inputRef.current.focus(), 10);
              }
            }
          }}
          onTouchStart={() => {
            if (keyboardMode === 'none') {
              setKeyboardMode('search');
            }
          }}
          placeholder="Artikul yoki nom bo'yicha qidirish..."
          autoComplete="off"
          className="w-full h-[42px] bg-surface hover:bg-raised border border-subtle hover:border-default rounded-xl pl-10 pr-4 text-[14px] text-primary focus:border-focus focus:bg-app focus:shadow-[0_0_0_4px_var(--bg-subtle)] placeholder:text-tertiary transition-all duration-200 shadow-sm outline-none"
        />
        {/* Auto-suggest Dropdown */}
        {filters.search && isSearchFocused && (
          <div className="absolute top-[48px] left-0 w-full bg-overlay border border-subtle shadow-2xl rounded-xl z-50 max-h-[360px] overflow-y-auto flex flex-col animate-fade-in no-scrollbar py-2">
            {products.length > 1 && searchInput.includes(',') && (
              <div className="px-3 pb-2 mb-2 border-b border-subtle flex justify-between items-center sticky top-0 bg-overlay z-10">
                <span className="text-13 text-secondary font-medium">{products.length} ta topildi</span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    let addedCount = 0;
                    let hasWarehouseMismatch = false;
                    let effectiveWarehouse = cartWarehouse;

                    products.slice(0, 50).forEach(product => {
                      const suggestUnit = cartUnits[product._id] || product.unit || 'rulon';
                      const suggestRemaining = getRemainingStock(product, suggestUnit);
                      if (suggestRemaining > 0) {
                        const quantity = Math.min(cartQuantities[product._id] || 1, suggestRemaining);
                        const prodWarehouseId = product.warehouse?._id || product.warehouse;
                        
                        if (!effectiveWarehouse) {
                          effectiveWarehouse = prodWarehouseId;
                        }

                        if (String(effectiveWarehouse) === String(prodWarehouseId)) {
                           addToCart(product, quantity, suggestUnit);
                           addedCount++;
                        } else {
                           hasWarehouseMismatch = true;
                        }
                      }
                    });
                    if(addedCount > 0) {
                      toast.success(`${addedCount} ta maxsulot savatga qo'shildi!`);
                      if(hasWarehouseMismatch) toast.error("Ba'zi maxsulotlar boshqa skladda bo'lgani uchun qo'shilmadi.");
                      clearSearch();
                    } else if (hasWarehouseMismatch) {
                      toast.error("Maxsulotlar boshqa skladda bo'lgani uchun qo'shilmadi.");
                    } else {
                      toast.error("Barcha maxsulotlar zaxirasi tugagan.");
                    }
                  }}
                  className="px-3 py-1.5 bg-accent text-inverse rounded-lg text-12 font-semibold active:scale-95 transition-all shadow-sm flex items-center gap-1.5"
                >
                  <ShoppingBag className="w-3.5 h-3.5" />
                  Barchasini qo'shish
                </button>
              </div>
            )}
            {products.length === 0 ? (
              <div className="p-4 text-center text-13 text-tertiary">Bunday artikul topilmadi</div>
            ) : (
              <ul className="flex flex-col relative z-0">
                {products.slice(0, 10).map(product => (
                  <li 
                    key={`search-${product._id}`} 
                    className="px-3 py-2 hover:bg-subtle cursor-pointer flex items-center justify-between border-b border-subtle last:border-b-0 transition-colors"
                    onClick={() => {
                      setSearchInput(product.artikul);
                      setFilters(p => ({ ...p, search: product.artikul }));
                      setIsSearchFocused(false);
                    }}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 w-full pr-2">
                      <div 
                        className="hidden sm:flex relative w-10 h-10 rounded border border-subtle bg-raised overflow-hidden shrink-0 items-center justify-center cursor-pointer group/img"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (product.images && product.images.length > 0) setViewerImages(product.images);
                        }}
                      >
                        {product.images?.[0] ? (
                          <>
                            <img src={product.images[0].url.replace('/upload/', '/upload/c_limit,w_100,q_auto,f_auto/')} loading="lazy" className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110" />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity z-10 backdrop-blur-[1px]">
                              <div className="bg-white/30 p-1 rounded-full text-white backdrop-blur-md transform scale-90 group-hover/img:scale-100 transition-transform duration-300">
                                <Eye className="w-3.5 h-3.5" />
                              </div>
                            </div>
                          </>
                        ) : (
                          <Grid3X3 className="w-5 h-5 text-tertiary" strokeWidth={1.5} />
                        )}
                      </div>
                      <div className="flex flex-1 items-center justify-between min-w-0 py-1.5">
                        <div className="flex flex-col gap-1.5 min-w-0 pr-3 justify-center">
                          <div className="text-[18px] font-[800] text-primary tracking-tight truncate leading-none">{product.artikul}</div>
                          <div className="text-[11px] font-[600] text-gray-400 uppercase tracking-widest truncate leading-none">{product.brand || 'Brendsiz'}</div>
                        </div>
                        
                        <div className="flex flex-col items-end gap-1.5 shrink-0 justify-center">
                          <div className="text-[15px] font-[700] text-primary leading-none">
                            {formatUZS(product.pricePerRoll || product.wholesalePrice).replace(" so'm", "")} <span className="text-[10px] text-gray-400 font-medium">UZS</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-[500] text-gray-500 truncate max-w-[80px] text-right">{product.warehouse?.name}</span>
                            <span className={`text-[13px] font-[800] px-1.5 py-0.5 rounded-md leading-none ${product.quantity <= product.minStock ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                              {formatQuantity(product.quantity, product.rollLength)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {(() => {
                      const suggestUnit = cartUnits[product._id] || product.unit || 'rulon';
                      const suggestRemaining = getRemainingStock(product, suggestUnit);
                      const suggestOutOfStock = (product.quantity || 0) <= 0;
                      const suggestCartMax = !suggestOutOfStock && suggestRemaining <= 0;
                      return (
                        <div 
                          className={`flex items-center bg-surface border rounded-lg overflow-hidden shrink-0 ml-3 transition-all ${
                            suggestRemaining <= 0 ? 'border-subtle opacity-70' : 'border-subtle hover:border-default focus-within:border-focus focus-within:ring-2 focus-within:ring-accent/10 shadow-sm'
                          }`}
                          onClick={e => e.stopPropagation()}
                        >
                          <input
                            type="number"
                            min="1"
                            max={suggestRemaining}
                            defaultValue="1"
                            id={`suggest-qty-${product._id}`}
                            className="w-11 sm:w-12 h-9 bg-transparent text-center text-[13px] font-[600] text-primary outline-none focus:bg-app placeholder:text-disabled transition-colors"
                            disabled={suggestRemaining <= 0}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                document.getElementById(`suggest-btn-${product._id}`)?.click();
                              }
                            }}
                          />
                          <div className="w-[1px] h-5 bg-subtle" />
                          <button 
                            id={`suggest-btn-${product._id}`}
                            disabled={suggestRemaining <= 0}
                            onClick={(e) => { 
                              e.stopPropagation();
                              const input = document.getElementById(`suggest-qty-${product._id}`);
                              const inputQty = parseInt(input?.value || "1", 10);
                              const quantity = Math.min(Math.max(1, inputQty), suggestRemaining);
                              const unit = suggestUnit;
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
                            className={`w-10 h-9 flex items-center justify-center transition-colors ${
                              suggestRemaining <= 0 
                                ? 'text-disabled cursor-not-allowed bg-subtle' 
                                : 'text-inverse bg-accent hover:bg-accent-hover'
                            }`}
                            title={suggestOutOfStock ? "Skladda yo'q" : suggestCartMax ? "Savatda (Maks)" : "Savatga qo'shish"}
                          >
                            <ShoppingBag className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })()}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      
      <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
        {/* Toggle Filters Button */}
        <button
          onClick={() => setShowMobileFilters(prev => !prev)}
          className={`h-[42px] px-3 sm:px-4 rounded-xl border text-[14px] font-[500] transition-all duration-200 flex items-center justify-center gap-2 flex-1 sm:flex-none active:scale-95 shadow-sm ${
            showMobileFilters || [
              filters.warehouse && filters.warehouse !== 'all' ? 'warehouse' : '',
              filters.category,
              filters.brand,
              filters.lowStock ? 'lowStock' : ''
            ].filter(Boolean).length > 0
              ? 'border-accent bg-subtle text-primary' 
              : 'border-subtle bg-surface text-secondary hover:text-primary hover:border-default hover:bg-raised'
          }`}
          type="button"
        >
          <SlidersHorizontal className="w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={1.5} />
          <span className="inline font-[600]">Filtrlar</span>
          {[
            filters.warehouse && filters.warehouse !== 'all' ? 'warehouse' : '',
            filters.category,
            filters.brand,
            filters.lowStock ? 'lowStock' : ''
          ].filter(Boolean).length > 0 && (
            <span className="bg-accent text-inverse text-[10px] font-bold h-4 min-w-[16px] px-1 rounded-full flex items-center justify-center shadow-xs">
              {[
                filters.warehouse && filters.warehouse !== 'all' ? 'warehouse' : '',
                filters.category,
                filters.brand,
                filters.lowStock ? 'lowStock' : '',
                filters.deadStock ? 'deadStock' : '',
                filters.sortBy !== 'createdAt' ? 'sortBy' : ''
              ].filter(Boolean).length}
            </span>
          )}
        </button>

        {/* Quick Sort/Filter Arrows */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button 
            onClick={() => {
              if (filters.sortBy === 'popular') {
                setFilters(p => ({...p, sortBy: 'createdAt'}));
              } else {
                setFilters(p => ({...p, sortBy: 'popular', deadStock: false}));
              }
            }}
            className={`h-[42px] px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${filters.sortBy === 'popular' ? 'bg-orange-50 border-orange-200 text-orange-600' : 'bg-surface border-subtle text-secondary hover:text-primary hover:bg-raised hover:border-default'}`}
            title="Ko'p sotilayotgan (TOP) va kam qolganlar"
          >
            <ArrowUp className="w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={2} />
            <span className="text-[13px] font-[600] hidden lg:inline">Top / Tugayotgan</span>
          </button>
          
          <button 
            onClick={() => {
              if (filters.deadStock) {
                setFilters(p => ({...p, deadStock: false}));
              } else {
                setFilters(p => ({...p, deadStock: true, sortBy: 'unpopular', lowStock: false}));
              }
            }}
            className={`h-[42px] px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all shadow-sm active:scale-95 ${filters.deadStock ? 'bg-slate-100 border-slate-300 text-slate-700' : 'bg-surface border-subtle text-secondary hover:text-primary hover:bg-raised hover:border-default'}`}
            title="Sotilmayotgan (Passiv) zaxira"
          >
            <ArrowDown className="w-4 h-4 sm:w-[18px] sm:h-[18px]" strokeWidth={2} />
            <span className="text-[13px] font-[600] hidden lg:inline">Passiv zaxira</span>
          </button>
        </div>

        {/* Layout Mode switcher */}
        <div className="flex items-center bg-subtle border border-subtle rounded-xl p-1 h-[42px] shrink-0 relative w-[86px] shadow-sm">
          <div className={`absolute top-1 bottom-1 w-[38px] bg-surface border border-subtle rounded-[8px] transition-all duration-300 shadow-sm ${viewMode === 'grid' ? 'left-1' : 'left-[42px]'}`} />
          <button 
            onClick={() => setViewMode('grid')} 
            className={`relative z-10 w-[38px] h-full flex items-center justify-center transition-colors duration-200 ${viewMode === 'grid' ? 'text-primary' : 'text-tertiary hover:text-secondary'}`}
          >
            <LayoutGrid className="w-4 h-4" strokeWidth={1.5} />
          </button>
          <button 
            onClick={() => setViewMode('table')} 
            className={`relative z-10 w-[38px] h-full flex items-center justify-center transition-colors duration-200 ${viewMode === 'table' ? 'text-primary' : 'text-tertiary hover:text-secondary'}`}
          >
            <List className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductSearchAndFilters;
