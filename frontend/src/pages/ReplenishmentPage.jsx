import React, { useState, useEffect } from 'react';
import { Send, Grid3X3, RefreshCcw, Package, AlertCircle } from 'lucide-react';
import { useReplenishmentProducts } from '../hooks/useProducts';
import { useAuth } from '../contexts/AuthContext';
import { useTransfer } from '../contexts/TransferContext';
import { useWarehouses } from '../hooks/useWarehouses';
import CustomSelect from '../components/CustomSelect';
import { haptics } from '../utils/haptics';
import toast from 'react-hot-toast';

const ReplenishmentPage = () => {
  const { user } = useAuth();
  const { addToTransfer } = useTransfer();
  
  const isSuperAdmin = user?.role === 'superadmin' || user?.role === 'admin';
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('');

  const { data: warehousesRes } = useWarehouses();
  const warehouses = warehousesRes?.data || [];

  useEffect(() => {
    if (isSuperAdmin && !selectedWarehouseId && warehouses.length > 0) {
      setSelectedWarehouseId(warehouses[0]._id);
    }
  }, [isSuperAdmin, warehouses, selectedWarehouseId]);

  const targetWarehouseId = isSuperAdmin ? selectedWarehouseId : (user?.warehouse?._id || user?.warehouse);

  const { data: replData, isLoading } = useReplenishmentProducts(targetWarehouseId);
  const products = replData?.data || [];

  const handleRequest = (otherProduct) => {
    addToTransfer(otherProduct, 1, otherProduct.unit || 'rulon');
    haptics.light();
  };

  return (
    <div className="h-full flex flex-col bg-app p-3 sm:p-6 lg:p-8 overflow-hidden max-w-full mx-auto w-full animate-fade-in">
      
      {/* Enterprise Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-[20px] font-[600] text-primary tracking-tight">Aqlli Ta'minot</h1>
          <p className="text-[13px] text-secondary mt-1">Tugayotgan mahsulotlarni zaxiralash tizimi</p>
        </div>

        {isSuperAdmin && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <CustomSelect
              value={selectedWarehouseId}
              onChange={(val) => setSelectedWarehouseId(val)}
              options={warehouses.map(wh => ({ value: wh._id, label: wh.name }))}
              placeholder="Filialni tanlang"
              className="w-full sm:w-[220px]"
            />
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-[100px]">
        {isLoading ? (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-64 w-full bg-surface border border-subtle rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : (!targetWarehouseId || products.length === 0) ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-surface border border-dashed border-subtle rounded-xl">
            <Package className="w-8 h-8 text-tertiary mb-4" strokeWidth={1.5} />
            <h2 className="text-[14px] font-[600] text-primary mb-1">Omborda holat barqaror</h2>
            <p className="text-[13px] text-secondary">
              Hozircha zaxirani to'ldirish talab etiladigan mahsulotlar yo'q.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((p) => (
              <div 
                key={p._id} 
                className="bg-surface border border-subtle rounded-xl flex flex-col hover:border-default transition-colors shadow-sm overflow-hidden"
              >
                {/* Structured Header */}
                <div className="flex items-center justify-between p-3 sm:p-4 border-b border-subtle bg-subtle/10 dark:bg-subtle/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded border border-subtle overflow-hidden flex items-center justify-center shrink-0 bg-app">
                      {p.images?.[0] ? (
                        <img src={p.images[0].url.replace('/upload/', '/upload/c_limit,w_100,q_auto,f_auto/')} className="w-full h-full object-cover" alt={p.artikul} />
                      ) : (
                        <Grid3X3 className="w-5 h-5 text-tertiary" strokeWidth={1.5} />
                      )}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <div className="text-[14px] font-[600] text-primary truncate leading-tight mb-0.5">{p.artikul}</div>
                      <div className="text-[12px] font-[400] text-secondary truncate">{p.brand || 'Brendsiz'}</div>
                    </div>
                  </div>
                  
                  {/* Current Stock */}
                  <div className="flex flex-col items-end">
                    <span className="text-[18px] font-[700] text-red-600 dark:text-red-400 leading-none mb-1">{p.quantity || 0}</span>
                    <span className="text-[10px] font-[500] text-tertiary uppercase tracking-wider">Qoldiq</span>
                  </div>
                </div>

                {/* Content: Recommended Branches */}
                <div className="p-3 sm:p-4 flex-1 flex flex-col bg-surface">
                  <div className="text-[12px] font-[500] text-primary mb-3">Tavsiya etilgan filiallar</div>
                  <div className="border border-subtle rounded-lg divide-y divide-subtle bg-surface">
                    {p.availableInOthers.map(other => (
                      <div 
                        key={other._id} 
                        className="flex items-center justify-between p-2.5 hover:bg-subtle/30 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: other.warehouse?.color || '#cbd5e1' }} />
                          <span className="text-[13px] font-[500] text-primary truncate">
                            {other.warehouse?.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 shrink-0 ml-3">
                          <span className="text-[13px] font-[600] text-primary px-2 py-1 bg-subtle/50 rounded border border-subtle/50 shrink-0">
                            {other.quantity} <span className="font-[400] text-secondary">{p.unit || 'ta'}</span>
                          </span>
                          
                          <button
                            type="button"
                            onClick={() => handleRequest(other)}
                            className="h-[30px] px-3.5 rounded-full bg-surface border border-subtle text-[12px] font-[500] text-primary hover:bg-subtle/50 hover:border-default transition-colors flex items-center justify-center gap-1.5 shrink-0"
                            title={`${other.warehouse?.name}dan so'rov yuborish`}
                          >
                            <Send className="w-3.5 h-3.5 text-secondary" />
                            So'rash
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReplenishmentPage;
