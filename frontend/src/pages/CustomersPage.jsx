import React, { useState } from 'react';
import { 
  Plus, Search, Contact, Phone, MapPin, X, Pencil, Trash2, Banknote 
} from 'lucide-react';
import { useCustomersInfinite, useDeleteCustomer } from '../hooks/useCustomers';
import { useOrders } from '../hooks/useOrders';
import { usePayments } from '../hooks/usePayments';
import CustomerModal from '../components/CustomerModal';
import PaymentModal from '../components/PaymentModal';
import ConfirmModal from '../components/ConfirmModal';
import CustomSelect from '../components/CustomSelect';
import { formatUZS, formatDate } from '../utils/format';
import toast from 'react-hot-toast';

const CustomersPage = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [sidePanelTab, setSidePanelTab] = useState('info'); // 'info' | 'orders' | 'payments'
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [filters, setFilters] = useState({ search: '', type: 'Barchasi' });
  
  const { 
    data: customersData, 
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage
  } = useCustomersInfinite(filters);

  const deleteMutation = useDeleteCustomer();

  const customers = customersData?.pages?.flatMap(page => page.data) || [];
  const totalCustomersCount = customersData?.pages?.[0]?.pagination?.total || 0;

  const observer = React.useRef();
  const lastCustomerElementRef = React.useCallback(node => {
    if (isLoading || isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleDelete = (id) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = () => {
    if (!confirmDeleteId) return;
    deleteMutation.mutate(confirmDeleteId, {
      onSuccess: () => {
        if (selectedCustomer?._id === confirmDeleteId) setSelectedCustomer(null);
        toast.success("Mijoz muvaffaqiyatli o'chirildi");
      },
      onError: () => {
        toast.error("Mijozni o'chirishda xatolik yuz berdi");
      }
    });
  };

  const openCustomerPanel = (customer) => {
    setSelectedCustomer(customer);
    setSidePanelTab('info');
  };

  const closeCustomerPanel = () => {
    setSelectedCustomer(null);
  };

  return (
    <div className="flex h-full relative overflow-hidden">
      
      {/* Main Content Area */}
      <div className={`p-2 sm:p-[32px_40px] flex-1 flex flex-col h-full transition-all duration-200 ease-out ${selectedCustomer ? 'lg:pr-[400px]' : ''}`}>
        
        <div className="flex items-center justify-between mb-[24px] shrink-0">
          <div>
            <h1 className="text-28 font-[600] tracking-[-0.03em] text-primary">Mijozlar</h1>
            <p className="text-14 text-secondary mt-1">Jami {totalCustomersCount} ta mijoz</p>
          </div>
          <button 
            id="tour-new-customer"
            onClick={openCreateModal}
            className="w-10 h-10 sm:w-auto sm:h-[42px] sm:px-5 bg-accent text-inverse rounded-full text-[14px] font-[500] hover:bg-accent-hover active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer shadow-sm"
          >
            <Plus className="w-[18px] h-[18px]" strokeWidth={1.5} />
            <span className="hidden sm:inline">Yangi mijoz</span>
          </button>
        </div>

        <div className="flex gap-2 sm:gap-3 items-center mb-[24px] shrink-0 w-full relative z-20">
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 text-tertiary absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
            <input 
              name="search" value={filters.search} onChange={handleFilterChange}
              placeholder="Ism yoki telefon..."
              className="w-full h-[42px] bg-surface hover:bg-raised border border-subtle hover:border-default rounded-xl pl-10 pr-4 text-[14px] text-primary focus:border-focus focus:bg-app focus:shadow-[0_0_0_4px_var(--bg-subtle)] placeholder:text-tertiary transition-all duration-200 shadow-sm outline-none"
            />
          </div>
          
          <div className="relative shrink-0 w-[140px] sm:w-[160px]">
            <CustomSelect
              value={filters.type || 'Barchasi'}
              onChange={(val) => handleFilterChange({ target: { name: 'type', value: val } })}
              options={[
                { value: 'Barchasi', label: 'Barcha turlar' },
                { value: 'retail', label: 'Chakana' },
                { value: 'wholesale', label: 'Sotuv' }
              ]}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar pb-8">
          {isLoading ? (
            <div className="flex flex-col gap-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-[48px] w-full animate-shimmer rounded-none border-b border-subtle"></div>
              ))}
            </div>
          ) : customers.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center min-h-[320px]">
              <Contact className="w-[20px] h-[20px] text-tertiary mb-3" strokeWidth={1.5} />
              <h3 className="text-15 font-[500] text-secondary">Mijozlar topilmadi</h3>
              <p className="text-13 text-tertiary mt-1">Hali mijozlar qo'shilmagan.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <table className="hidden md:table w-full text-left text-13">
                <thead>
                  <tr className="border-b border-default text-11 font-[500] text-tertiary uppercase tracking-[0.06em]">
                    <th className="pl-4 pr-3 py-3 font-normal">Ism / Korxona</th>
                    <th className="px-3 py-3 font-normal">Telefon</th>
                    <th className="px-3 py-3 font-normal text-right">Keshbek</th>
                    <th className="px-3 py-3 font-normal text-right">Qarzdorlik</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer, index) => (
                    <tr 
                      ref={index === customers.length - 1 ? lastCustomerElementRef : null}
                      key={customer._id} 
                      onClick={() => openCustomerPanel(customer)}
                      className={`border-b border-subtle hover:bg-subtle cursor-pointer h-[48px] transition-colors ${selectedCustomer?._id === customer._id ? 'bg-subtle' : ''}`}
                    >
                      <td className="pl-4 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-[500] text-primary">{customer.name}</span>
                          {customer.type === 'wholesale' ? (
                            <span className="text-11 bg-state-info-bg text-state-info-text border border-state-info-border px-1.5 rounded font-[500]">Sotuv</span>
                          ) : (
                            <span className="text-11 bg-state-neutral-bg text-state-neutral-text border border-state-neutral-border px-1.5 rounded font-[500]">Chakana</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 text-secondary font-mono text-12">{customer.phone}</td>
                      <td className="px-3 text-right">
                        {customer.cashbackBalance > 0 ? (
                          <span className="text-state-success-text font-[500] font-mono">{formatUZS(customer.cashbackBalance)}</span>
                        ) : (
                          <span className="text-tertiary">-</span>
                        )}
                      </td>
                      <td className="px-3 text-right">
                        {customer.totalDebt > 0 ? (
                          <span className="text-state-danger-text font-[500] font-mono">{formatUZS(customer.totalDebt)}</span>
                        ) : (
                          <span className="text-tertiary">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile Card List View */}
              <div className="md:hidden space-y-3 pb-6">
                {customers.map((customer, index) => (
                  <div 
                    ref={index === customers.length - 1 ? lastCustomerElementRef : null}
                    key={customer._id}
                    onClick={() => openCustomerPanel(customer)}
                    className={`p-4 bg-surface border border-subtle rounded-2xl hover:bg-raised hover:border-default active:scale-[0.99] transition-all duration-200 cursor-pointer shadow-sm flex flex-col gap-2.5 ${
                      selectedCustomer?._id === customer._id ? 'border-accent bg-subtle/40 shadow-none' : ''
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="font-[600] text-14 text-primary block truncate">{customer.name}</span>
                        <span className="text-12 text-tertiary font-mono block mt-0.5">{customer.phone}</span>
                      </div>
                      {customer.type === 'wholesale' ? (
                        <span className="text-10 bg-state-info-bg text-state-info-text border border-state-info-border px-1.5 py-0.5 rounded font-[500] shrink-0">Sotuv</span>
                      ) : (
                        <span className="text-10 bg-state-neutral-bg text-state-neutral-text border border-state-neutral-border px-1.5 py-0.5 rounded font-[500] shrink-0">Chakana</span>
                      )}
                    </div>
                    
                    {(customer.totalDebt > 0 || customer.cashbackBalance > 0) && (
                      <div className="pt-2 border-t border-subtle flex flex-col gap-1.5 text-12">
                        {customer.cashbackBalance > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-secondary font-[500]">Keshbek:</span>
                            <span className="text-state-success-text font-[600] font-mono">{formatUZS(customer.cashbackBalance)}</span>
                          </div>
                        )}
                        {customer.totalDebt > 0 && (
                          <div className="flex justify-between items-center">
                            <span className="text-secondary font-[500]">Qarzdorlik:</span>
                            <span className="text-state-danger-text font-[600] font-mono">{formatUZS(customer.totalDebt)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {isFetchingNextPage && (
            <div className="py-6 flex justify-center w-full mt-2">
              <div className="w-8 h-8 rounded-full border-[3px] border-accent/20 border-t-accent animate-spin" />
            </div>
          )}
        </div>
      </div>

      {/* Side Panel */}
      <div 
        className={`absolute top-0 right-0 h-full w-full sm:w-[400px] bg-surface border-l border-subtle shadow-[-4px_0_24px_rgba(0,0,0,0.02)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] flex flex-col z-30 ${selectedCustomer ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {selectedCustomer && (
          <CustomerSidePanel 
            customer={selectedCustomer} 
            onClose={closeCustomerPanel} 
            onEdit={() => openEditModal(selectedCustomer)}
            onDelete={() => handleDelete(selectedCustomer._id)}
            onPayment={() => setIsPaymentModalOpen(true)}
            tab={sidePanelTab}
            setTab={setSidePanelTab}
          />
        )}
      </div>

      <CustomerModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} customer={editingCustomer} />
      {selectedCustomer && (
        <PaymentModal 
          isOpen={isPaymentModalOpen} 
          onClose={() => setIsPaymentModalOpen(false)} 
          customerId={selectedCustomer._id}
          customerName={selectedCustomer.name}
        />
      )}
      <ConfirmModal
        isOpen={!!confirmDeleteId}
        onClose={() => setConfirmDeleteId(null)}
        onConfirm={confirmDelete}
        title="Mijozni o'chirish"
        message="Rostdan bu mijozni o'chirmoqchimisiz? Bu amalni qaytarib bo'lmaydi."
        confirmText="O'chirish"
        cancelText="Bekor qilish"
        isDanger={true}
      />
    </div>
  );
};

// Sub-component for Side Panel content
const CustomerSidePanel = ({ customer, onClose, onEdit, onDelete, onPayment, tab, setTab }) => {
  const { data: ordersRes, isLoading: ordersLoading } = useOrders({ customer: customer._id });
  const { data: paymentsRes, isLoading: paymentsLoading } = usePayments({ customer: customer._id });

  const orders = ordersRes?.data || [];
  const payments = paymentsRes?.data || [];

  return (
    <>
      <div className="h-14 px-6 border-b border-subtle flex items-center justify-between shrink-0 bg-app">
        <div className="flex flex-col min-w-0 pr-4">
          <div className="text-15 font-[600] text-primary truncate flex items-center gap-2">
            {customer.name}
            {customer.type === 'wholesale' ? (
              <span className="text-11 bg-state-info-bg text-state-info-text border border-state-info-border px-1.5 rounded font-[500] h-5 flex items-center">Sotuv</span>
            ) : (
              <span className="text-11 bg-state-neutral-bg text-state-neutral-text border border-state-neutral-border px-1.5 rounded font-[500] h-5 flex items-center">Chakana</span>
            )}
          </div>
        </div>
        <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded transition-colors shrink-0">
          <X className="w-[16px] h-[16px]" strokeWidth={1.5} />
        </button>
      </div>

      <div className="flex px-6 border-b border-subtle shrink-0 bg-app">
        {['info', 'orders', 'payments'].map((t) => (
          <button
            key={t}
            className={`pb-3 pt-3 mr-6 text-13 transition-colors relative capitalize ${tab === t ? 'text-primary font-[500]' : 'text-secondary hover:text-primary'}`}
            onClick={() => setTab(t)}
          >
            {t === 'info' ? 'Ma\'lumot' : t === 'orders' ? 'Buyurtmalar' : 'To\'lovlar'}
            {tab === t && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-accent"></div>}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'info' && (
          <div className="space-y-6">
            <div className="flex gap-2">
              <button onClick={onEdit} className="flex-1 h-8 bg-surface border border-default rounded text-12 font-[500] text-primary hover:bg-subtle flex items-center justify-center gap-1.5 transition-colors">
                <Pencil className="w-[14px] h-[14px]" strokeWidth={1.5} /> Tahrirlash
              </button>
              <button onClick={onDelete} className="flex-1 h-8 bg-surface border border-default rounded text-12 font-[500] text-state-danger-text hover:bg-state-danger-bg hover:border-state-danger-border flex items-center justify-center gap-1.5 transition-colors">
                <Trash2 className="w-[14px] h-[14px]" strokeWidth={1.5} /> O'chirish
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-12 font-[500] text-secondary mb-1">Telefon</div>
                <div className="text-13 text-primary flex items-center gap-2 font-mono"><Phone className="w-[14px] h-[14px] text-tertiary" strokeWidth={1.5}/> {customer.phone}</div>
              </div>
              {customer.address && (
                <div>
                  <div className="text-12 font-[500] text-secondary mb-1">Manzil</div>
                  <div className="text-13 text-primary flex items-start gap-2"><MapPin className="w-[14px] h-[14px] text-tertiary mt-0.5" strokeWidth={1.5}/> {customer.address}</div>
                </div>
              )}
              {customer.cashbackPercent > 0 && (
                <div>
                  <div className="text-12 font-[500] text-secondary mb-1">Keshbek foizi</div>
                  <div className="text-13 text-primary flex items-start gap-2"><Banknote className="w-[14px] h-[14px] text-state-success-text mt-0.5" strokeWidth={1.5}/> {customer.cashbackPercent}%</div>
                </div>
              )}
              {customer.notes && (
                <div>
                  <div className="text-12 font-[500] text-secondary mb-1">Izoh</div>
                  <div className="text-13 text-primary bg-subtle p-3 rounded-md border border-subtle">{customer.notes}</div>
                </div>
              )}
            </div>

            <div className="p-4 bg-state-danger-bg border border-state-danger-border rounded-md flex flex-col items-center text-center">
              <div className="text-12 text-state-danger-text font-[500] mb-1">Joriy qarzdorlik</div>
              <div className="text-24 font-[600] text-state-danger-text tracking-tight mb-3">{formatUZS(customer.totalDebt || 0)}</div>
              <button 
                onClick={onPayment}
                className="h-8 px-4 bg-surface border border-state-danger-border text-state-danger-text rounded text-12 font-[500] hover:bg-state-danger-text hover:text-inverse transition-colors w-full"
              >
                To'lov qabul qilish
              </button>
            </div>

            {customer.cashbackBalance > 0 && (
              <div className="p-4 mt-4 bg-state-success-bg border border-state-success-border rounded-md flex flex-col items-center text-center">
                <div className="text-12 text-state-success-text font-[500] mb-1">Mavjud keshbek (Bonus)</div>
                <div className="text-24 font-[600] text-state-success-text tracking-tight mb-1">{formatUZS(customer.cashbackBalance)}</div>
                <div className="text-11 text-state-success-text/80">Keyingi xaridlarda ishlatish mumkin</div>
              </div>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-4">
            {ordersLoading ? (
               <div className="animate-shimmer h-20 w-full rounded-md"></div>
            ) : orders.length === 0 ? (
               <div className="text-13 text-tertiary text-center py-8">Buyurtmalar yo'q</div>
            ) : (
               orders.map(order => (
                 <div key={order._id} className="border border-subtle rounded-md p-3 bg-app hover:bg-subtle transition-colors">
                   <div className="flex justify-between items-center mb-2">
                     <span className="text-12 font-mono text-primary font-[500]">{order.orderNumber}</span>
                     <span className="text-11 text-tertiary">{formatDate(order.createdAt)}</span>
                   </div>
                   <div className="flex justify-between items-center">
                     <span className="text-13 font-mono font-[500] text-primary">{formatUZS(order.totalAmount)}</span>
                     {order.status === 'pending' && <span className="text-11 text-state-warning-text">Kutilmoqda</span>}
                     {order.status === 'confirmed' && <span className="text-11 text-state-info-text">Tasdiqlangan</span>}
                     {order.status === 'delivered' && <span className="text-11 text-state-success-text">Yetkazilgan</span>}
                     {order.status === 'cancelled' && <span className="text-11 text-state-danger-text">Bekor</span>}
                   </div>
                   {order.debtAmount > 0 && (
                     <div className="mt-2 pt-2 border-t border-subtle text-11 text-state-danger-text text-right">
                       Qarz: {formatUZS(order.debtAmount)}
                     </div>
                   )}
                 </div>
               ))
            )}
          </div>
        )}

        {tab === 'payments' && (
          <div className="space-y-4">
            {paymentsLoading ? (
               <div className="animate-shimmer h-20 w-full rounded-md"></div>
            ) : payments.length === 0 ? (
               <div className="text-13 text-tertiary text-center py-8">To'lovlar yo'q</div>
            ) : (
               payments.map(payment => (
                 <div key={payment._id} className="border border-subtle rounded-md p-3 bg-app flex justify-between items-center">
                   <div>
                     <div className="flex items-center gap-2 mb-1">
                       <Banknote className="w-[14px] h-[14px] text-tertiary" strokeWidth={1.5} />
                       <span className="text-13 font-[500] text-primary capitalize">{payment.method}</span>
                     </div>
                     <div className="text-11 text-tertiary">{formatDate(payment.createdAt)}</div>
                   </div>
                   <div className="text-13 font-mono font-[500] text-state-success-text">
                     +{formatUZS(payment.amount)}
                   </div>
                 </div>
               ))
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default CustomersPage;
