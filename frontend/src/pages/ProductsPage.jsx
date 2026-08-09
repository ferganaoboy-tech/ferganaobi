import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Grid3X3 } from 'lucide-react';
import { useProductsInfinite, useFilters, useDeleteProduct } from '../hooks/useProducts';
import { useWarehouses } from '../hooks/useWarehouses';
import ProductModal from '../components/ProductModal';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import { useCart } from '../contexts/CartContext';
import { useTransfer } from '../contexts/TransferContext';
import { useAuth } from '../contexts/AuthContext';
import toast from 'react-hot-toast';
import { haptics } from '../utils/haptics';
import ConfirmModal from '../components/ConfirmModal';
import ImageViewerModal from '../components/ImageViewerModal';
import CompareModal from '../components/CompareModal';

import ProductHeader from './products/components/ProductHeader';
import ProductSearchAndFilters from './products/components/ProductSearchAndFilters';
import ProductMobileFilters from './products/components/ProductMobileFilters';
import ProductGridItem from './products/components/ProductGridItem';
import ProductTableDesktopRow from './products/components/ProductTableDesktopRow';
import ProductTableMobileRow from './products/components/ProductTableMobileRow';

const ProductsPage = () => {
  const location = useLocation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [compareProduct, setCompareProduct] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [viewerImages, setViewerImages] = useState(null);
  const searchRef = React.useRef(null);
  const inputRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (e) => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { addToCart, cartWarehouse, setCartOpen, cartItems } = useCart();
  const { addToTransfer, setIsTransferOpen, transferItems } = useTransfer();
  const { user } = useAuth();
  const [cartQuantities, setCartQuantities] = useState({});
  const [cartUnits, setCartUnits] = useState({});
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [confirmWarehouseSwitch, setConfirmWarehouseSwitch] = useState(null);

  const getRemainingStock = (product, unit) => {
    if (!product) return 0;
    const productCartItems = cartItems?.filter(item => item.product === product._id) || [];
    let cartQtyInRolls = 0;
    productCartItems.forEach(item => {
      const rollsPerBox = product.rollsPerBox || 6;
      const rollLength = product.rollLength || 10;
      if (item.unit === 'quti') {
        cartQtyInRolls += item.quantity * rollsPerBox;
      } else if (item.unit === 'metr') {
        cartQtyInRolls += item.quantity / rollLength;
      } else {
        cartQtyInRolls += item.quantity;
      }
    });

    const stockInRolls = product.quantity || 0;
    const remainingInRolls = Math.max(0, stockInRolls - cartQtyInRolls);

    const rollsPerBox = product.rollsPerBox || 6;
    const rollLength = product.rollLength || 10;

    if (unit === 'quti') return Math.floor(remainingInRolls / rollsPerBox);
    if (unit === 'metr') return Math.floor(remainingInRolls * rollLength);
    return Math.floor(remainingInRolls);
  };

  const handleConfirmWarehouseSwitch = () => {
    if (confirmWarehouseSwitch) {
      const { product, quantity, unit } = confirmWarehouseSwitch;
      addToCart(product, quantity, unit, true);
      setCartQuantities(prev => ({ ...prev, [product._id]: 1 }));
    }
  };

  const handleQtyChange = (productId, val, maxVal) => {
    haptics.light();
    let capped;
    if (val === '') {
      capped = '';
    } else {
      // still prevent negative, but allow 0 temporarily if they type it, or just limit to maxVal
      capped = Math.max(0, Math.min(Number(val) || 0, maxVal));
    }
    setCartQuantities(prev => ({
      ...prev,
      [productId]: capped
    }));
  };

  const [filters, setFilters] = useState({
    search: location.state?.search || '',
    warehouse: (user?.role !== 'superadmin' && user?.role !== 'admin' && user?.warehouse) ? (user.warehouse._id || user.warehouse) : 'all',
    category: '',
    brand: '',
    polka: '',
    lowStock: false,
    deadStock: false,
    sortBy: 'popular',
  });

  const [searchInput, setSearchInput] = useState(location.state?.search || '');

  const clearSearch = React.useCallback(() => {
    setSearchInput('');
    setFilters(prev => ({ ...prev, search: '' }));
    setIsSearchFocused(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  React.useEffect(() => {
    if (user?.role !== 'superadmin' && user?.role !== 'admin' && user?.warehouse) {
      setFilters(prev => ({
        ...prev,
        warehouse: prev.warehouse || (user.warehouse._id || user.warehouse)
      }));
    }
  }, [user]);

  const { data: productsData, isLoading, isFetchingNextPage, hasNextPage, fetchNextPage } = useProductsInfinite(filters);
  const { data: filterOptionsRes } = useFilters();
  const { data: whRes } = useWarehouses({ basic: true });
  const deleteMutation = useDeleteProduct();

  const products = productsData?.pages?.flatMap(page => page.data) || [];
  const totalProductsCount = productsData?.pages?.[0]?.pagination?.total || 0;

  const observer = React.useRef();
  const lastProductElementRef = React.useCallback(node => {
    if (isLoading || isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  const filterOptions = filterOptionsRes?.data || { brands: [], polkas: [] };
  const warehouses = whRes?.data || [];

  const handleFilterChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === 'search') {
      setSearchInput(value);
      if (!isSearchFocused) setIsSearchFocused(true);
      return;
    }
    setFilters(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setIsModalOpen(true);
    setOpenDropdownId(null);
  };

  const openCreateModal = () => {
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openCompareModal = (product) => {
    setCompareProduct(product);
  };

  const handleDelete = (id) => {
    setConfirmDeleteId(id);
    setOpenDropdownId(null);
  };

  const toggleDropdown = (id) => {
    setOpenDropdownId(prev => prev === id ? null : id);
  };

  return (
    <div className="p-2 sm:p-[32px_40px] h-full flex flex-col">
      <ProductHeader 
        totalProductsCount={totalProductsCount} 
        openCreateModal={openCreateModal} 
      />

      <ProductSearchAndFilters
        searchRef={searchRef}
        inputRef={inputRef}
        searchInput={searchInput}
        setSearchInput={setSearchInput}
        handleFilterChange={handleFilterChange}
        isSearchFocused={isSearchFocused}
        setIsSearchFocused={setIsSearchFocused}
        filters={filters}
        setFilters={setFilters}
        products={products}
        setViewerImages={setViewerImages}
        cartUnits={cartUnits}
        getRemainingStock={getRemainingStock}
        cartQuantities={cartQuantities}
        cartWarehouse={cartWarehouse}
        setConfirmWarehouseSwitch={setConfirmWarehouseSwitch}
        addToCart={addToCart}
        clearSearch={clearSearch}
        showMobileFilters={showMobileFilters}
        setShowMobileFilters={setShowMobileFilters}
        viewMode={viewMode}
        setViewMode={setViewMode}
      />

      <ProductMobileFilters
        showMobileFilters={showMobileFilters}
        filters={filters}
        setFilters={setFilters}
        handleFilterChange={handleFilterChange}
        warehouses={warehouses}
        filterOptions={filterOptions}
        user={user}
      />

      <div className="flex-1 overflow-y-auto min-h-[320px] no-scrollbar pb-24">
        {isLoading ? (
          <div className="h-full flex flex-col gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 w-full animate-shimmer rounded-md"></div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <Grid3X3 className="w-[20px] h-[20px] text-tertiary mb-3" strokeWidth={1.5} />
            <h3 className="text-15 font-[500] text-secondary">Mahsulot topilmadi</h3>
            <p className="text-13 text-tertiary mt-1">Boshqa qidiruv so'zi bilan urinib ko'ring.</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 min-[360px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4 auto-rows-max">
            {products.map((product, index) => (
              <ProductGridItem
                key={product._id}
                ref={index === products.length - 1 ? lastProductElementRef : null}
                product={product}
                user={user}
                cartUnits={cartUnits}
                cartQuantities={cartQuantities}
                getRemainingStock={getRemainingStock}
                cartWarehouse={cartWarehouse}
                setConfirmWarehouseSwitch={setConfirmWarehouseSwitch}
                addToCart={addToCart}
                addToTransfer={addToTransfer}
                handleQtyChange={handleQtyChange}
                setViewerImages={setViewerImages}
                toggleDropdown={toggleDropdown}
                openDropdownId={openDropdownId}
                setOpenDropdownId={setOpenDropdownId}
                openEditModal={openEditModal}
                handleDelete={handleDelete}
                clearSearch={clearSearch}
                openCompareModal={openCompareModal}
              />
            ))}
          </div>
        ) : (
          <div className="w-full flex flex-col border border-subtle rounded-md bg-surface">
            {/* Desktop Table View */}
            <div className="hidden md:block w-full overflow-x-auto">
              <table className="w-full text-left text-13 min-w-[800px]">
                <thead>
                  <tr className="border-b border-default text-11 font-[500] text-tertiary uppercase tracking-[0.06em]">
                    <th className="pl-4 pr-3 py-3 font-normal">Mahsulot (Brend)</th>
                    <th className="px-3 py-3 font-normal">Sklad</th>
                    <th className="px-3 py-3 font-normal">Polka</th>
                    <th className="px-3 py-3 font-normal text-right">Narxlar</th>
                    <th className="px-3 py-3 font-normal text-right">Zaxira</th>
                    <th className="px-3 py-3 font-normal text-center">Savatga</th>
                    <th className="pl-3 pr-4 py-3 font-normal text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product, index) => (
                    <ProductTableDesktopRow
                      key={product._id}
                      ref={index === products.length - 1 ? lastProductElementRef : null}
                      product={product}
                      user={user}
                      cartUnits={cartUnits}
                      cartQuantities={cartQuantities}
                      getRemainingStock={getRemainingStock}
                      cartWarehouse={cartWarehouse}
                      setConfirmWarehouseSwitch={setConfirmWarehouseSwitch}
                      addToCart={addToCart}
                      addToTransfer={addToTransfer}
                      setViewerImages={setViewerImages}
                      openEditModal={openEditModal}
                      handleDelete={handleDelete}
                      clearSearch={clearSearch}
                      openCompareModal={openCompareModal}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Compact List View */}
            <div className="md:hidden flex flex-col divide-y divide-subtle/50">
              {products.map((product, idx) => (
                <ProductTableMobileRow
                  key={`mobile-${product._id}`}
                  ref={idx === products.length - 1 ? lastProductElementRef : null}
                  product={product}
                  user={user}
                  cartUnits={cartUnits}
                  cartQuantities={cartQuantities}
                  getRemainingStock={getRemainingStock}
                  cartWarehouse={cartWarehouse}
                  setConfirmWarehouseSwitch={setConfirmWarehouseSwitch}
                  addToCart={addToCart}
                  addToTransfer={addToTransfer}
                  handleQtyChange={handleQtyChange}
                  setViewerImages={setViewerImages}
                  toggleDropdown={toggleDropdown}
                  openDropdownId={openDropdownId}
                  setOpenDropdownId={setOpenDropdownId}
                  openEditModal={openEditModal}
                  handleDelete={handleDelete}
                  clearSearch={clearSearch}
                  openCompareModal={openCompareModal}
                />
              ))}
            </div>
          </div>
        )}

        {isFetchingNextPage && (
          <div className="py-6 flex justify-center w-full mt-2">
            <div className="w-8 h-8 rounded-full border-[3px] border-accent/20 border-t-accent animate-spin" />
          </div>
        )}
      </div>

      <ProductModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} product={editingProduct} />
      <BarcodeScannerModal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} onScan={(text) => { setFilters(prev => ({ ...prev, search: text })); setIsScannerOpen(false); toast.success("Skanerlandi: " + text); haptics.light(); }} />
      <ConfirmModal isOpen={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} onConfirm={() => { if (confirmDeleteId) { deleteMutation.mutate(confirmDeleteId); toast.success("Mahsulot muvaffaqiyatli o'chirildi"); } }} title="Mahsulotni o'chirish" message="Rostdan o'chirishni istaysizmi?" confirmText="O'chirish" cancelText="Bekor qilish" isDanger={true} />
      <ConfirmModal isOpen={!!confirmWarehouseSwitch} onClose={() => setConfirmWarehouseSwitch(null)} onConfirm={handleConfirmWarehouseSwitch} title="Skladni almashtirish" message="Savatda boshqa skladdan mahsulot bor. Savatni tozalab, yangi skladdan boshlaymizmi?" confirmText="Almashtirish" cancelText="Bekor qilish" isDanger={true} />
      <CompareModal isOpen={!!compareProduct} onClose={() => setCompareProduct(null)} product={compareProduct} />
      {viewerImages && <ImageViewerModal images={viewerImages} onClose={() => setViewerImages(null)} />}
    </div>
  );
};

export default ProductsPage;
