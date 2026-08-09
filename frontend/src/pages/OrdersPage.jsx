import React, { useState } from 'react';
import { 
  Plus, CheckCircle, XCircle, Truck, Clock, ChevronDown, ChevronRight, FileText, Printer, CornerDownLeft, Filter, SortDesc, SortAsc, Package, Search, Calendar
} from 'lucide-react';
import { useOrders, useConfirmOrder, useCancelOrder, useDeliverOrder } from '../hooks/useOrders';
import { formatUZS, formatDateTime } from '../utils/format';
import { useCart } from '../contexts/CartContext';
import CustomSelect from '../components/CustomSelect';
import CheckViewModal from '../components/CheckViewModal';
import ReturnModal from '../components/ReturnModal';

const OrdersPage = () => {
  const { setCartOpen } = useCart();
  const [expandedOrder, setExpandedOrder] = useState(null);
  const [checkOrder, setCheckOrder] = useState(null);
  const [returnOrder, setReturnOrder] = useState(null);

  const [filters, setFilters] = useState({
    status: 'Barchasi',
    type: 'Barchasi',
    paymentType: 'Barchasi',
    search: '',
    dateFrom: '',
    dateTo: ''
  });

  const { data: ordersRes, isLoading } = useOrders(filters);
  const confirmMutation = useConfirmOrder();
  const cancelMutation = useCancelOrder();
  const deliverMutation = useDeliverOrder();

  const orders = ordersRes?.data || [];

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending': 
        return <span className="bg-amber-50 text-amber-600 border border-amber-200/50 px-2.5 h-6 rounded-md flex items-center text-[12px] font-[600] shadow-sm">Kutilmoqda</span>;
      case 'confirmed': 
        return <span className="bg-blue-50 text-blue-600 border border-blue-200/50 px-2.5 h-6 rounded-md flex items-center text-[12px] font-[600] shadow-sm">Tasdiqlangan</span>;
      case 'delivered': 
        return <span className="bg-emerald-50 text-emerald-600 border border-emerald-200/50 px-2.5 h-6 rounded-md flex items-center text-[12px] font-[600] shadow-sm">Yetkazilgan</span>;
      case 'cancelled': 
        return <span className="bg-red-50 text-red-600 border border-red-200/50 px-2.5 h-6 rounded-md flex items-center text-[12px] font-[600] shadow-sm">Bekor qilingan</span>;
      default: return null;
    }
  };

  const handleAction = (action, id) => {
    if (action === 'confirm') confirmMutation.mutate(id);
    if (action === 'cancel') cancelMutation.mutate(id);
    if (action === 'deliver') deliverMutation.mutate(id);
  };

  const toggleExpand = (id) => {
    setExpandedOrder(prev => prev === id ? null : id);
  };

  const TABS = [
    { label: 'Barchasi', value: 'Barchasi' },
    { label: 'Kutilmoqda', value: 'pending' },
    { label: 'Tasdiqlangan', value: 'confirmed' },
    { label: 'Yetkazilgan', value: 'delivered' },
    { label: 'Bekor', value: 'cancelled' }
  ];

  return (
    <div className="flex flex-col h-full bg-app overflow-hidden">
      {/* Premium Header */}
      <header className="pt-4 pb-3 px-4 md:px-8 border-b border-subtle bg-surface shrink-0 relative z-20">
        <div className="flex items-center justify-between gap-4">
          
          {/* Title Area */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-accent flex items-center justify-center text-inverse shadow-lg shadow-accent/30 shrink-0">
              <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-[20px] sm:text-[24px] md:text-[28px] font-[800] tracking-tight text-primary leading-none">
                Buyurtmalar
              </h1>
              <p className="text-[12px] sm:text-[14px] font-[500] text-tertiary mt-1">
                <span className="font-[700] text-primary">{ordersRes?.pagination?.total || 0}</span> ta mavjud
              </p>
            </div>
          </div>

          {/* Action Button */}
          <button 
            id="tour-new-order"
            onClick={() => setCartOpen(true)}
            className="h-9 sm:h-[44px] px-3 sm:px-6 bg-accent text-inverse rounded-xl sm:rounded-2xl text-[13px] sm:text-[14px] font-[600] hover:bg-accent-hover active:scale-95 transition-all flex items-center justify-center gap-1.5 shrink-0 shadow-lg shadow-accent/20"
          >
            <Plus className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={2} /> 
            <span className="hidden sm:inline">Yangi buyurtma</span>
            <span className="sm:hidden">Yangi</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col gap-4 mt-5">
          
          <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 w-full">
            {/* Status Tabs (Pills) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar w-full xl:w-auto pb-1 xl:pb-0">
              {TABS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => handleFilterChange({ target: { name: 'status', value: tab.value } })}
                  className={`shrink-0 h-9 px-4 rounded-xl text-[13px] font-[600] whitespace-nowrap transition-all border ${
                    filters.status === tab.value 
                    ? 'bg-primary text-inverse border-primary shadow-md' 
                    : 'bg-surface text-tertiary border-subtle hover:text-secondary hover:bg-subtle'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 w-full xl:w-auto shrink-0 overflow-x-auto no-scrollbar pb-1 xl:pb-0">
              {/* Date Range */}
              <div className="flex items-center gap-2 bg-surface border border-subtle rounded-xl h-[38px] px-3 shadow-sm hover:border-accent/50 transition-colors shrink-0">
                <Calendar className="w-4 h-4 text-tertiary" />
                <input 
                  type="date"
                  name="dateFrom"
                  value={filters.dateFrom || ''}
                  onChange={handleFilterChange}
                  className="bg-transparent text-[13px] text-primary focus:outline-none w-[110px] cursor-pointer"
                />
                <span className="text-tertiary text-[12px] font-medium">-</span>
                <input 
                  type="date"
                  name="dateTo"
                  value={filters.dateTo || ''}
                  onChange={handleFilterChange}
                  className="bg-transparent text-[13px] text-primary focus:outline-none w-[110px] cursor-pointer"
                />
              </div>

              {/* Search Bar */}
              <div className="relative w-[200px] sm:w-[250px] shrink-0">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tertiary" />
                <input 
                  type="text" 
                  name="search"
                  placeholder="Buyurtma raqamini qidiring..." 
                  value={filters.search || ''}
                  onChange={handleFilterChange}
                  className="w-full h-[38px] pl-9 pr-4 bg-surface border border-subtle rounded-xl text-[13px] text-primary focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all shadow-sm placeholder:text-tertiary"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-auto px-2 sm:px-4 md:px-8 pt-4 sm:pt-6 pb-24 md:pb-8 bg-subtle/10 relative">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-[60px] w-full bg-subtle/40 animate-pulse rounded-2xl border border-subtle"></div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center bg-surface border border-subtle rounded-3xl shadow-sm">
            <div className="w-16 h-16 rounded-full bg-subtle flex items-center justify-center text-tertiary mb-4">
              <FileText className="w-8 h-8" />
            </div>
            <h3 className="text-[18px] font-[700] text-primary tracking-tight">Buyurtmalar topilmadi</h3>
            <p className="text-[14px] text-tertiary mt-2">Hozircha tanlangan filtrlarga mos buyurtmalar yo'q.</p>
          </div>
        ) : (
          <div className="w-full flex flex-col overflow-hidden">
            
            {/* Desktop Table */}
            <div className="hidden lg:block w-full overflow-hidden bg-surface border border-subtle rounded-3xl shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead className="bg-subtle/30">
                  <tr>
                    <th className="w-10 px-4 py-4"></th>
                    <th className="px-5 py-4 text-[12px] font-[600] text-tertiary uppercase tracking-wider border-b border-subtle">Buyurtma</th>
                    <th className="px-5 py-4 text-[12px] font-[600] text-tertiary uppercase tracking-wider border-b border-subtle">Mijoz</th>
                    <th className="px-5 py-4 text-[12px] font-[600] text-tertiary uppercase tracking-wider border-b border-subtle">Turi & Sklad</th>
                    <th className="px-5 py-4 text-[12px] font-[600] text-tertiary uppercase tracking-wider border-b border-subtle text-right">To'lov</th>
                    <th className="px-5 py-4 text-[12px] font-[600] text-tertiary uppercase tracking-wider border-b border-subtle text-right">Jami summa</th>
                    <th className="px-5 py-4 text-[12px] font-[600] text-tertiary uppercase tracking-wider border-b border-subtle text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-subtle">
                  {orders.map(order => (
                    <React.Fragment key={order._id}>
                      <tr 
                        onClick={() => toggleExpand(order._id)}
                        className="hover:bg-subtle/40 cursor-pointer group transition-colors"
                      >
                        <td className="px-4 py-4 text-tertiary group-hover:text-accent transition-colors">
                          <div className="w-6 h-6 flex items-center justify-center rounded-lg group-hover:bg-accent/10">
                            {expandedOrder === order._id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[14px] font-[700] text-primary">{order.orderNumber}</span>
                            {order.notes && order.notes.includes('qaytarildi') && (
                              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-[700] uppercase tracking-wider">Vozvrat</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 text-[12px] text-tertiary font-[500] mt-1">
                            <Clock className="w-3.5 h-3.5" />
                            {formatDateTime(order.createdAt)}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-[14px] font-[700] text-primary truncate max-w-[200px]">{order.customer?.name}</div>
                          <div className="text-[12px] text-secondary mt-0.5">{order.seller?.name || 'Asosiy'}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="text-[14px] font-[600] text-primary capitalize">{order.type === 'wholesale' ? 'Sotuv' : 'Chakana'}</div>
                          <div className="text-[12px] text-secondary mt-0.5">{order.warehouse?.name}</div>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="inline-block bg-subtle/50 px-2 py-1 rounded-md text-[13px] font-[600] text-secondary capitalize">{order.paymentType}</div>
                          {order.debtAmount > 0 && <div className="text-[11px] font-[600] text-red-500 mt-1">Qarz: {formatUZS(order.debtAmount)}</div>}
                        </td>
                        <td className="px-5 py-4 text-right">
                          <span className="font-mono text-[15px] font-[800] text-primary">{formatUZS(order.totalAmount)}</span>
                        </td>
                        <td className="px-5 py-4 text-right flex items-center justify-end">
                          {getStatusBadge(order.status)}
                        </td>
                      </tr>
                      
                      {/* Expanded Section */}
                      {expandedOrder === order._id && (
                        <tr className="bg-app shadow-inner">
                          <td colSpan="7" className="p-0">
                            <div className="pl-14 pr-6 py-5 border-l-2 border-accent">
                              
                              <div className="bg-surface rounded-2xl border border-subtle overflow-hidden mb-4 shadow-sm">
                                <table className="w-full text-left">
                                  <thead className="bg-subtle/30">
                                    <tr>
                                      <th className="px-4 py-3 text-[11px] font-[600] text-tertiary uppercase">Mahsulot</th>
                                      <th className="px-4 py-3 text-[11px] font-[600] text-tertiary uppercase text-right">Miqdor</th>
                                      <th className="px-4 py-3 text-[11px] font-[600] text-tertiary uppercase text-right">Narx</th>
                                      <th className="px-4 py-3 text-[11px] font-[600] text-tertiary uppercase text-right">Jami</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-subtle">
                                    {order.items.map((item, idx) => (
                                      <tr key={idx}>
                                        <td className="px-4 py-3 flex items-center gap-3">
                                          <div className="w-10 h-10 rounded-xl bg-subtle border border-subtle overflow-hidden shrink-0">
                                             {item.product?.images?.[0] ? (
                                               <img src={item.product.images[0].url} className="w-full h-full object-cover" />
                                             ) : (
                                               <div className="w-full h-full flex items-center justify-center text-tertiary"><FileText className="w-4 h-4 opacity-50"/></div>
                                             )}
                                          </div>
                                          <div className="flex flex-col">
                                            <span className="font-[700] text-[13px] text-primary">{item.product?.name || item.product?.artikul}</span>
                                            <span className="text-[11px] font-mono text-tertiary">{item.product?.artikul}</span>
                                          </div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                          <span className="text-[13px] font-[700] text-secondary">{item.quantity} {item.unit}</span>
                                          {item.returnedQuantity > 0 && (
                                            <div className="mt-1">
                                              <span className="text-red-600 bg-red-50 text-[10px] font-[700] px-1.5 py-0.5 rounded-md border border-red-200">
                                                -{item.returnedQuantity} qaytgan
                                              </span>
                                            </div>
                                          )}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-[13px] text-secondary">{formatUZS(item.unitPrice)}</td>
                                        <td className="px-4 py-3 text-right font-mono font-[700] text-primary">{formatUZS(item.subtotal)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>

                              {order.notes && (
                                <div className="text-[13px] text-amber-700 bg-amber-50 p-3 rounded-xl mb-4 border border-amber-200 shadow-sm flex items-start gap-2">
                                  <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                                  <p><strong className="font-[700]">Izoh:</strong> {order.notes}</p>
                                </div>
                              )}

                              <div className="flex items-center gap-3">
                                <button 
                                  onClick={() => setCheckOrder(order)} 
                                  className="h-10 px-4 text-[13px] font-[600] text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 rounded-xl flex items-center gap-2 transition-all active:scale-95 shadow-sm"
                                >
                                  <Printer className="w-4 h-4" /> Chek chiqarish
                                </button>

                                {(order.status === 'confirmed' || order.status === 'delivered') && (
                                  <button 
                                    onClick={() => setReturnOrder(order)} 
                                    className="h-10 px-4 text-[13px] font-[600] text-red-600 bg-red-50 border border-red-200 hover:bg-red-100 hover:border-red-300 rounded-xl flex items-center gap-2 transition-all ml-auto active:scale-95 shadow-sm"
                                  >
                                    <CornerDownLeft className="w-4 h-4" /> Vozvrat qabul qilish
                                  </button>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden flex flex-col gap-3 mt-1">
              {orders.map(order => (
                <div key={`mobile-${order._id}`} className="bg-surface border border-subtle rounded-2xl sm:rounded-3xl overflow-hidden shadow-sm flex flex-col">
                  <button
                    onClick={() => toggleExpand(order._id)}
                    className="w-full text-left p-3.5 sm:p-5 flex flex-col gap-3 sm:gap-4 active:bg-subtle transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[16px] font-[800] text-primary">{order.orderNumber}</span>
                          {order.notes && order.notes.includes('qaytarildi') && (
                            <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded text-[10px] font-[800] uppercase tracking-wider">Vozvrat</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[12px] text-tertiary font-[500]">
                          <Clock className="w-3.5 h-3.5" />
                          {formatDateTime(order.createdAt)}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {getStatusBadge(order.status)}
                      </div>
                    </div>

                    <div className="bg-subtle/50 rounded-xl sm:rounded-2xl p-3 sm:p-4 border border-subtle">
                      <div className="font-[700] text-[14px] sm:text-[15px] text-primary leading-tight">{order.customer?.name}</div>
                      <div className="flex items-center gap-2 text-[12px] text-secondary mt-1 font-[500]">
                        <span className="capitalize">{order.type === 'wholesale' ? 'Sotuv' : 'Chakana'}</span>
                        <span className="w-1 h-1 bg-subtle rounded-full"></span>
                        <span>{order.warehouse?.name}</span>
                      </div>
                    </div>

                    <div className="flex items-end justify-between pt-1">
                      <div>
                        <div className="text-[11px] text-tertiary font-[600] uppercase tracking-wider mb-1">Jami Summa</div>
                        <div className="font-[800] font-mono text-[18px] text-primary leading-none tracking-tight">{formatUZS(order.totalAmount)}</div>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="px-2 py-0.5 bg-subtle rounded-md text-[11px] font-[600] text-secondary capitalize">{order.paymentType}</span>
                          {order.debtAmount > 0 && <span className="px-2 py-0.5 text-[11px] font-[700] text-red-500 bg-red-50 rounded-md">Qarz: {formatUZS(order.debtAmount)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => setCheckOrder(order)}
                          className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center active:scale-95 transition-all shadow-sm"
                        >
                          <Printer className="w-5 h-5" />
                        </button>
                        <div className="w-10 h-10 rounded-xl bg-subtle flex items-center justify-center text-tertiary transition-transform duration-200">
                          {expandedOrder === order._id ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                        </div>
                      </div>
                    </div>
                  </button>

                  {/* Expanded Mobile View */}
                  {expandedOrder === order._id && (
                    <div className="border-t border-subtle bg-subtle/20 p-3.5 sm:p-5 flex flex-col gap-3 sm:gap-4">
                      
                      <div className="bg-surface rounded-xl sm:rounded-2xl border border-subtle shadow-sm overflow-hidden flex flex-col divide-y divide-subtle">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex gap-3 p-3 sm:p-4">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-subtle overflow-hidden shrink-0 border border-subtle flex items-center justify-center">
                              {item.product?.images?.[0] ? <img src={item.product.images[0].url} className="w-full h-full object-cover" /> : <Package className="w-6 h-6 text-tertiary opacity-50" />}
                            </div>
                            <div className="flex flex-col flex-1 min-w-0 justify-center">
                              <span className="text-[13px] sm:text-[14px] font-[700] text-primary truncate">{item.product?.name || item.product?.artikul}</span>
                              <div className="flex justify-between items-center mt-1 sm:mt-1.5">
                                <span className="text-[12px] font-[600] text-secondary">{item.quantity} {item.unit} <span className="text-tertiary font-normal ml-1">× {formatUZS(item.unitPrice)}</span></span>
                                <span className="text-[13px] sm:text-[14px] font-[800] font-mono text-primary">{formatUZS(item.subtotal)}</span>
                              </div>
                              {item.returnedQuantity > 0 && (
                                <div className="mt-1.5">
                                  <span className="text-red-600 text-[10px] font-[700] bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                                    ↩ {item.returnedQuantity} ta qaytgan
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {order.notes && (
                        <div className="text-[13px] text-amber-700 bg-amber-50 px-4 py-3 rounded-2xl border border-amber-200/60 shadow-sm leading-relaxed">
                          <strong className="font-[700]">Izoh:</strong> {order.notes}
                        </div>
                      )}

                      {(order.status === 'confirmed' || order.status === 'delivered') && (
                        <button
                          onClick={() => setReturnOrder(order)}
                          className="h-11 sm:h-12 w-full rounded-2xl bg-red-50 text-red-600 border border-red-200 text-[14px] font-[700] flex items-center justify-center gap-2 active:scale-95 transition-all shadow-sm mt-1"
                        >
                          <CornerDownLeft className="w-5 h-5" /> Vozvrat qilish
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      
      <CheckViewModal 
        isOpen={!!checkOrder} 
        order={checkOrder} 
        onClose={() => setCheckOrder(null)} 
      />
      <ReturnModal
        isOpen={!!returnOrder}
        order={returnOrder}
        onClose={() => setReturnOrder(null)}
      />
    </div>
  );
};

export default OrdersPage;
