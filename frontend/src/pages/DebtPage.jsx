import React, { useState, useMemo } from 'react';
import { Scale, Search, Phone, ChevronRight, AlertCircle, Users, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDebtors } from '../hooks/useCustomers';
import PaymentModal from '../components/PaymentModal';
import { formatUZS } from '../utils/format';

const DebtPage = () => {
  const [search, setSearch] = useState('');
  const [paymentModalData, setPaymentModalData] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();

  const handleSync = async () => {
    setIsSyncing(true);
    await queryClient.invalidateQueries({ queryKey: ['debtors'] });
    setTimeout(() => setIsSyncing(false), 500);
  };

  const { data: debtorsRes, isLoading } = useDebtors();
  const debtors = debtorsRes?.data || [];

  const filteredDebtors = useMemo(() => {
    if (!search) return debtors;
    const lower = search.toLowerCase();
    return debtors.filter(d => d.name.toLowerCase().includes(lower) || d.phone.includes(lower));
  }, [search, debtors]);

  const totalDebt = useMemo(() => debtors.reduce((sum, d) => sum + d.totalDebt, 0), [debtors]);

  return (
    <div className="p-2 pb-[100px] sm:p-[32px_40px] animate-fade-in">
      <div className="flex items-center justify-between mb-[32px] shrink-0">
        <div>
          <h1 className="text-28 font-[600] tracking-[-0.03em] text-primary">Qarzdorlik</h1>
          <p className="text-14 text-secondary mt-1">Mijozlarning joriy nasiya va qarzlari holati.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 sm:mb-[32px] shrink-0">
        <div className="bg-surface border border-subtle rounded-lg p-5 flex items-start justify-between relative overflow-hidden group">
          <div className="absolute inset-y-0 left-0 w-1 bg-state-danger-text opacity-80" />
          <div>
            <div className="flex items-center gap-2 text-13 text-secondary mb-2">
              <AlertCircle className="w-[16px] h-[16px] text-state-danger-text" strokeWidth={1.5} /> Jami qarzdorlik
            </div>
            <div className="text-28 font-[600] text-state-danger-text tracking-tight font-mono">
              {formatUZS(totalDebt)}
            </div>
          </div>
        </div>

        <div className="bg-surface border border-subtle rounded-lg p-5 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-13 text-secondary mb-2">
              <Users className="w-[16px] h-[16px] text-tertiary" strokeWidth={1.5} /> Qarzdor mijozlar
            </div>
            <div className="text-28 font-[600] text-primary tracking-tight font-mono">
              {debtors.length}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-surface border border-subtle rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between bg-app/50 gap-3">
          <div className="relative w-full sm:w-[300px]">
            <Search className="w-[14px] h-[14px] text-tertiary absolute left-[12px] top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
            <input 
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Mijoz ismi yoki telefon..."
              className="w-full h-10 bg-surface border border-default rounded-lg pl-9 pr-3 text-13 text-primary focus:border-focus placeholder:text-tertiary transition-colors shadow-sm"
            />
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            className="h-10 px-4 bg-surface border border-subtle rounded-lg text-13 font-[500] text-secondary flex items-center gap-2 hover:bg-subtle hover:text-primary transition-all active:scale-95 disabled:opacity-50 shadow-sm whitespace-nowrap w-full sm:w-auto justify-center"
          >
            <RefreshCw className={`w-[14px] h-[14px] ${isSyncing ? 'animate-spin' : ''}`} strokeWidth={1.5} />
            Sinxronlash
          </button>
        </div>

        <div className="w-full">
          {isLoading ? (
            <div className="flex flex-col gap-4 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-[60px] w-full animate-shimmer rounded-lg"></div>
              ))}
            </div>
          ) : filteredDebtors.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-4">
              <div className="w-16 h-16 bg-raised rounded-full flex items-center justify-center mb-4 border border-subtle shadow-sm">
                <Scale className="w-[24px] h-[24px] text-tertiary" strokeWidth={1.5} />
              </div>
              <h3 className="text-16 font-[600] text-primary">Mijozlarda qarz yo'q</h3>
              <p className="text-14 text-secondary mt-1.5 max-w-sm">Siz izlagan mezon bo'yicha hech qanday qarzdor mijoz topilmadi.</p>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block w-full overflow-x-auto">
                <table className="w-full text-left text-13 min-w-[700px]">
                  <thead className="bg-surface sticky top-0 z-10">
                    <tr className="border-b border-subtle text-11 font-[600] text-secondary uppercase tracking-[0.05em] bg-app/30">
                      <th className="pl-6 pr-3 py-3.5 font-normal">Mijoz</th>
                      <th className="px-3 py-3.5 font-normal">Telefon</th>
                      <th className="px-3 py-3.5 font-normal text-right">Qarz miqdori</th>
                      <th className="pl-3 pr-6 py-3.5 font-normal text-right">Amal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDebtors.map(debtor => (
                      <tr key={debtor._id} className="border-b border-subtle hover:bg-subtle h-[64px] group transition-colors">
                        <td className="pl-6 pr-3">
                          <div className="flex items-center gap-3.5">
                            <div className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center text-13 font-[600] shrink-0 border border-accent/20 shadow-sm">
                              {debtor.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-[600] text-primary text-14">{debtor.name}</div>
                              <div className="text-12 text-secondary mt-0.5">{debtor.type === 'wholesale' ? 'Sotuv mijoz' : 'Chakana mijoz'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 text-secondary font-mono text-13">
                          <div className="flex items-center gap-2"><Phone className="w-[14px] h-[14px] text-tertiary" strokeWidth={1.5}/> {debtor.phone}</div>
                        </td>
                        <td className="px-3 text-right">
                          <span className="text-15 font-[600] text-state-danger-text font-mono">{formatUZS(debtor.totalDebt)}</span>
                        </td>
                        <td className="pl-3 pr-6 text-right align-middle">
                          <button 
                            onClick={() => setPaymentModalData({ customerId: debtor._id, customerName: debtor.name, totalDebt: debtor.totalDebt })}
                            className="h-9 px-4 rounded-lg text-13 font-[500] bg-surface text-primary border border-default hover:border-accent hover:text-accent transition-all ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-2 shadow-sm focus:opacity-100"
                          >
                            To'lov qabul qilish <ChevronRight className="w-[14px] h-[14px]" strokeWidth={2} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View */}
              <div className="md:hidden flex flex-col bg-subtle/30">
                {filteredDebtors.map((debtor, idx) => (
                  <div key={`mobile-${debtor._id}`} className={`p-4 flex flex-col gap-3.5 bg-surface hover:bg-subtle active:bg-subtle transition-colors ${idx !== filteredDebtors.length - 1 ? 'border-b border-subtle' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center text-14 font-[600] shrink-0 border border-accent/20 shadow-sm">
                          {debtor.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-14 font-[600] text-primary">{debtor.name}</div>
                          <div className="text-12 text-secondary mt-0.5">{debtor.type === 'wholesale' ? 'Sotuv mijoz' : 'Chakana mijoz'}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-15 font-[700] text-state-danger-text font-mono tracking-tight">{formatUZS(debtor.totalDebt)}</div>
                        <div className="text-[10px] text-tertiary uppercase font-[600] tracking-wider mt-0.5">Joriy qarz</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-3.5 border-t border-subtle/60 mt-0.5">
                      <div className="flex items-center gap-1.5 text-secondary font-mono text-13">
                        <div className="w-6 h-6 rounded bg-raised flex items-center justify-center border border-subtle">
                          <Phone className="w-[12px] h-[12px] text-tertiary" strokeWidth={1.5}/>
                        </div>
                        {debtor.phone}
                      </div>
                      <button 
                        onClick={() => setPaymentModalData({ customerId: debtor._id, customerName: debtor.name, totalDebt: debtor.totalDebt })}
                        className="h-8 px-4 rounded-lg text-12 font-[600] bg-accent text-inverse hover:bg-accent-hover transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm shadow-accent/20"
                      >
                        To'lov <ChevronRight className="w-[14px] h-[14px]" strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {paymentModalData && (
        <PaymentModal 
          isOpen={true} 
          onClose={() => setPaymentModalData(null)} 
          customerId={paymentModalData.customerId}
          customerName={paymentModalData.customerName}
          totalDebt={paymentModalData.totalDebt}
        />
      )}
    </div>
  );
};

export default DebtPage;
