import React, { useState, useMemo } from 'react';
import {
  Scale, Search, Phone, ChevronRight, AlertCircle,
  Users, RefreshCw, TrendingUp, Wallet, History
} from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useDebtors } from '../hooks/useCustomers';
import PaymentModal from '../components/PaymentModal';
import DebtPaymentHistoryDrawer from '../components/DebtPaymentHistoryDrawer';
import { useCurrency } from '../contexts/CurrencyContext';

// ─── Progress Bar (inline, kichik) ────────────────────────────────────────────
function MiniProgressBar({ paidPercent, totalPaid, currentDebt, formatPrice }) {
  const clamp = Math.max(0, Math.min(100, paidPercent || 0));
  const color = clamp >= 75 ? '#22c55e' : clamp >= 40 ? '#f59e0b' : '#ef4444';

  if ((totalPaid || 0) === 0 && (currentDebt || 0) === 0) return null;

  return (
    <div className="mt-2 space-y-1">
      {/* Bar */}
      <div className="relative h-1.5 bg-subtle rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{ width: `${clamp}%`, backgroundColor: color }}
        />
      </div>
      {/* Label */}
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-emerald-600 font-[600]">
          {formatPrice(totalPaid || 0)} to'langan
        </span>
        <span className="text-tertiary font-[500]">{clamp}%</span>
      </div>
    </div>
  );
}

// ─── timeAgo helper ───────────────────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return null;
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Bugun';
  if (days === 1) return 'Kecha';
  if (days < 30) return `${days} kun oldin`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} oy oldin`;
  return `${Math.floor(months / 12)} yil oldin`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const DebtPage = () => {
  const [search, setSearch] = useState('');
  const [paymentModalData, setPaymentModalData] = useState(null);
  const [historyDebtor, setHistoryDebtor] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const queryClient = useQueryClient();
  const { formatPrice } = useCurrency();

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
    return debtors.filter(d =>
      d.name.toLowerCase().includes(lower) || d.phone.includes(lower)
    );
  }, [search, debtors]);

  const totalDebt    = useMemo(() => debtors.reduce((s, d) => s + (d.totalDebt    || 0), 0), [debtors]);
  const totalPaidAll = useMemo(() => debtors.reduce((s, d) => s + (d.totalPaid    || 0), 0), [debtors]);
  const totalOrig    = useMemo(() => debtors.reduce((s, d) => s + (d.originalDebt || d.totalDebt || 0), 0), [debtors]);
  const overallPct   = totalOrig > 0 ? Math.round((totalPaidAll / totalOrig) * 100) : 0;

  return (
    <div className="p-2 pb-[100px] sm:p-[32px_40px] animate-fade-in">

      {/* ── Page Title ── */}
      <div className="flex items-center justify-between mb-[32px] shrink-0">
        <div>
          <h1 className="text-28 font-[600] tracking-[-0.03em] text-primary">Qarzdorlik</h1>
          <p className="text-14 text-secondary mt-1">Mijozlarning joriy nasiya va qarzlari holati.</p>
        </div>
      </div>

      {/* ── Summary Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 sm:mb-[32px] shrink-0">

        {/* Jami qarz */}
        <div className="bg-surface border border-subtle rounded-lg p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-state-danger-text opacity-80" />
          <div className="flex items-center gap-2 text-13 text-secondary mb-2">
            <AlertCircle className="w-4 h-4 text-state-danger-text" strokeWidth={1.5} />
            Jami qarzdorlik
          </div>
          <div className="text-28 font-[600] text-state-danger-text tracking-tight font-mono">
            {formatPrice(totalDebt)}
          </div>
        </div>

        {/* Jami to'langan */}
        <div className="bg-surface border border-subtle rounded-lg p-5 relative overflow-hidden">
          <div className="absolute inset-y-0 left-0 w-1 bg-emerald-500 opacity-80" />
          <div className="flex items-center gap-2 text-13 text-secondary mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-600" strokeWidth={1.5} />
            Jami to'langan
          </div>
          <div className="text-28 font-[600] text-emerald-600 tracking-tight font-mono">
            {formatPrice(totalPaidAll)}
          </div>
          {totalOrig > 0 && (
            <div className="mt-2">
              <div className="relative h-1.5 bg-subtle rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-emerald-500"
                  style={{ width: `${overallPct}%` }}
                />
              </div>
              <div className="text-[10px] text-tertiary mt-1">{overallPct}% umumiy to'lov</div>
            </div>
          )}
        </div>

        {/* Qarzdor mijozlar */}
        <div className="bg-surface border border-subtle rounded-lg p-5">
          <div className="flex items-center gap-2 text-13 text-secondary mb-2">
            <Users className="w-4 h-4 text-tertiary" strokeWidth={1.5} />
            Qarzdor mijozlar
          </div>
          <div className="text-28 font-[600] text-primary tracking-tight font-mono">
            {debtors.length}
          </div>
          <div className="text-[12px] text-tertiary mt-1">
            Dastlabki nasiya: {formatPrice(totalOrig)}
          </div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className="bg-surface border border-subtle rounded-xl overflow-hidden shadow-sm">

        {/* Toolbar */}
        <div className="p-4 border-b border-subtle flex flex-col sm:flex-row items-start sm:items-center justify-between bg-app/50 gap-3">
          <div className="relative w-full sm:w-[300px]">
            <Search className="w-[14px] h-[14px] text-tertiary absolute left-[12px] top-1/2 -translate-y-1/2 pointer-events-none" strokeWidth={1.5} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
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

        {/* Content */}
        <div className="w-full">
          {isLoading ? (
            <div className="flex flex-col gap-4 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-[64px] w-full animate-shimmer rounded-lg" />
              ))}
            </div>
          ) : filteredDebtors.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-20 px-4">
              <div className="w-16 h-16 bg-raised rounded-full flex items-center justify-center mb-4 border border-subtle shadow-sm">
                <Scale className="w-[24px] h-[24px] text-tertiary" strokeWidth={1.5} />
              </div>
              <h3 className="text-16 font-[600] text-primary">Mijozlarda qarz yo'q</h3>
              <p className="text-14 text-secondary mt-1.5 max-w-sm">
                Siz izlagan mezon bo'yicha hech qanday qarzdor mijoz topilmadi.
              </p>
            </div>
          ) : (
            <>
              {/* ────── Desktop Table ────── */}
              <div className="hidden md:block w-full overflow-x-auto">
                <table className="w-full text-left text-13">
                  <thead className="bg-surface sticky top-0 z-10">
                    <tr className="border-b border-subtle text-[11px] font-[600] text-secondary uppercase tracking-[0.05em] bg-app/30">
                      <th className="pl-6 pr-3 py-3.5 font-normal">Mijoz</th>
                      <th className="px-3 py-3.5 font-normal">Telefon</th>
                      <th className="px-3 py-3.5 font-normal text-right">Dastlabki nasiya</th>
                      <th className="px-3 py-3.5 font-normal text-right text-emerald-700">To'langan</th>
                      <th className="px-3 py-3.5 font-normal text-right text-state-danger-text">Qolgan qarz</th>
                      <th className="px-3 py-3.5 font-normal">Holat</th>
                      <th className="pl-3 pr-6 py-3.5 font-normal text-right">Amal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDebtors.map(debtor => {
                      const clamp = Math.max(0, Math.min(100, debtor.paidPercent || 0));
                      const barColor = clamp >= 75 ? '#22c55e' : clamp >= 40 ? '#f59e0b' : '#ef4444';

                      return (
                        <tr
                          key={debtor._id}
                          className="border-b border-subtle hover:bg-subtle h-auto group transition-colors"
                        >
                          {/* Mijoz */}
                          <td className="pl-6 pr-3 py-3">
                            <div className="flex items-center gap-3.5">
                              <div className="w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center text-13 font-[600] shrink-0 border border-accent/20 shadow-sm">
                                {debtor.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                {/* Nomi — bosib tarixni ochish */}
                                <button
                                  onClick={() => setHistoryDebtor(debtor)}
                                  className="font-[700] text-primary text-14 hover:text-accent hover:underline underline-offset-2 transition-colors cursor-pointer text-left"
                                  title="To'lov tarixini ko'rish"
                                >
                                  {debtor.name}
                                </button>
                                <div className="text-11 text-tertiary mt-0.5 flex items-center gap-2">
                                  <span>{debtor.type === 'wholesale' ? 'Ulgurji' : 'Chakana'}</span>
                                  {debtor.lastPaymentDate && (
                                    <>
                                      <span className="opacity-40">·</span>
                                      <span>So'nggi to'lov: {timeAgo(debtor.lastPaymentDate)}</span>
                                    </>
                                  )}
                                  {debtor.paymentCount > 0 && (
                                    <>
                                      <span className="opacity-40">·</span>
                                      <span>{debtor.paymentCount}× to'lov</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Telefon */}
                          <td className="px-3 text-secondary font-mono text-13 py-3">
                            <div className="flex items-center gap-2">
                              <Phone className="w-[14px] h-[14px] text-tertiary" strokeWidth={1.5} />
                              {debtor.phone}
                            </div>
                          </td>

                          {/* Dastlabki nasiya */}
                          <td className="px-3 text-right py-3">
                            <span className="text-13 font-[600] text-secondary font-mono">
                              {debtor.originalDebt > 0
                                ? formatPrice(debtor.originalDebt)
                                : formatPrice(debtor.totalDebt)}
                            </span>
                          </td>

                          {/* To'langan */}
                          <td className="px-3 text-right py-3">
                            {(debtor.totalPaid || 0) > 0 ? (
                              <span className="text-13 font-[700] text-emerald-600 font-mono">
                                {formatPrice(debtor.totalPaid)}
                              </span>
                            ) : (
                              <span className="text-11 text-tertiary italic">—</span>
                            )}
                          </td>

                          {/* Qolgan qarz */}
                          <td className="px-3 text-right py-3">
                            <span className="text-14 font-[700] text-state-danger-text font-mono">
                              {formatPrice(debtor.totalDebt)}
                            </span>
                          </td>

                          {/* Holat (Progress) */}
                          <td className="px-3 py-3 min-w-[140px]">
                            <div className="space-y-1">
                              <div className="relative h-2 bg-subtle rounded-full overflow-hidden w-full">
                                <div
                                  className="absolute left-0 top-0 h-full rounded-full transition-all"
                                  style={{ width: `${clamp}%`, backgroundColor: barColor }}
                                />
                              </div>
                              <div className="text-[10px] font-[600]" style={{ color: barColor }}>
                                {clamp}% to'langan
                              </div>
                            </div>
                          </td>

                          {/* Amal */}
                          <td className="pl-3 pr-6 text-right align-middle py-3">
                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity focus-within:opacity-100">
                              {/* Tarix */}
                              <button
                                onClick={() => setHistoryDebtor(debtor)}
                                className="h-8 w-8 rounded-lg border border-subtle bg-surface text-tertiary hover:text-accent hover:border-accent flex items-center justify-center shadow-sm transition-all"
                                title="To'lov tarixi"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                              {/* To'lov */}
                              <button
                                onClick={() => setPaymentModalData({
                                  customerId: debtor._id,
                                  customerName: debtor.name,
                                  totalDebt: debtor.totalDebt
                                })}
                                className="h-8 px-3 rounded-lg text-12 font-[600] bg-surface text-primary border border-default hover:border-accent hover:text-accent transition-all flex items-center gap-1.5 shadow-sm"
                              >
                                To'lov <ChevronRight className="w-[13px] h-[13px]" strokeWidth={2} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* ────── Mobile Card View ────── */}
              <div className="md:hidden flex flex-col bg-subtle/30">
                {filteredDebtors.map((debtor, idx) => (
                  <div
                    key={`mobile-${debtor._id}`}
                    className={`p-4 flex flex-col gap-3 bg-surface hover:bg-subtle active:bg-subtle transition-colors ${
                      idx !== filteredDebtors.length - 1 ? 'border-b border-subtle' : ''
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/10 text-accent flex items-center justify-center text-14 font-[600] shrink-0 border border-accent/20 shadow-sm">
                          {debtor.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          {/* Nomi — bosib tarixni ochish */}
                          <button
                            onClick={() => setHistoryDebtor(debtor)}
                            className="text-14 font-[700] text-primary text-left hover:text-accent transition-colors"
                          >
                            {debtor.name}
                          </button>
                          <div className="text-11 text-secondary mt-0.5">
                            {debtor.type === 'wholesale' ? 'Ulgurji' : 'Chakana'}
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="text-15 font-[700] text-state-danger-text font-mono tracking-tight">
                          {formatPrice(debtor.totalDebt)}
                        </div>
                        <div className="text-[10px] text-tertiary uppercase font-[600] tracking-wider mt-0.5">
                          Joriy qarz
                        </div>
                      </div>
                    </div>

                    {/* Payment info row */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div className="bg-subtle/60 rounded-lg px-2.5 py-2">
                        <div className="text-tertiary font-[500] mb-0.5">Dastlabki nasiya</div>
                        <div className="font-[700] text-secondary">
                          {formatPrice(debtor.originalDebt || debtor.totalDebt)}
                        </div>
                      </div>
                      <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-2">
                        <div className="text-emerald-700 font-[500] mb-0.5">To'langan</div>
                        <div className="font-[700] text-emerald-700">
                          {(debtor.totalPaid || 0) > 0 ? formatPrice(debtor.totalPaid) : '—'}
                        </div>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <MiniProgressBar
                      paidPercent={debtor.paidPercent || 0}
                      totalPaid={debtor.totalPaid || 0}
                      currentDebt={debtor.totalDebt}
                      formatPrice={formatPrice}
                    />

                    {/* Last payment + count */}
                    {(debtor.lastPaymentDate || debtor.paymentCount > 0) && (
                      <div className="text-[11px] text-tertiary flex items-center gap-2">
                        {debtor.lastPaymentDate && (
                          <span>So'nggi to'lov: <span className="font-[600] text-secondary">{timeAgo(debtor.lastPaymentDate)}</span></span>
                        )}
                        {debtor.paymentCount > 0 && (
                          <span className="opacity-40 hidden xs:inline">·</span>
                        )}
                        {debtor.paymentCount > 0 && (
                          <span className="hidden xs:inline">{debtor.paymentCount}× to'lov</span>
                        )}
                      </div>
                    )}

                    {/* Bottom action row */}
                    <div className="flex items-center justify-between pt-2 border-t border-subtle/60">
                      <div className="flex items-center gap-1.5 text-secondary font-mono text-12">
                        <div className="w-6 h-6 rounded bg-raised flex items-center justify-center border border-subtle">
                          <Phone className="w-[11px] h-[11px] text-tertiary" strokeWidth={1.5} />
                        </div>
                        {debtor.phone}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setHistoryDebtor(debtor)}
                          className="h-8 w-8 rounded-lg border border-subtle bg-surface text-tertiary hover:text-accent flex items-center justify-center transition-all"
                          title="To'lov tarixi"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setPaymentModalData({
                            customerId: debtor._id,
                            customerName: debtor.name,
                            totalDebt: debtor.totalDebt
                          })}
                          className="h-8 px-3 rounded-lg text-12 font-[600] bg-accent text-inverse hover:bg-accent-hover transition-colors flex items-center gap-1.5 active:scale-95 shadow-sm"
                        >
                          To'lov <ChevronRight className="w-[13px] h-[13px]" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Modals & Drawers ── */}
      {paymentModalData && (
        <PaymentModal
          isOpen={true}
          onClose={() => setPaymentModalData(null)}
          customerId={paymentModalData.customerId}
          customerName={paymentModalData.customerName}
          totalDebt={paymentModalData.totalDebt}
        />
      )}

      {historyDebtor && (
        <DebtPaymentHistoryDrawer
          debtor={historyDebtor}
          onClose={() => setHistoryDebtor(null)}
        />
      )}
    </div>
  );
};

export default DebtPage;
