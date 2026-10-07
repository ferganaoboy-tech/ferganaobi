import React, { useState } from 'react';
import {
  X, CreditCard, Banknote, Building2, Package,
  Clock, TrendingUp, ChevronDown, ChevronUp,
  AlertCircle, CheckCircle2, Wallet
} from 'lucide-react';
import { useCustomerPaymentHistory } from '../hooks/usePayments';
import { useCurrency } from '../contexts/CurrencyContext';

// ─── Yordamchi funksiyalar ────────────────────────────────────────────────────

const METHOD_META = {
  naqd:            { label: 'Naqd',          Icon: Banknote,   color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  cash:            { label: 'Naqd',          Icon: Banknote,   color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
  karta:           { label: 'Karta',         Icon: CreditCard, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  card:            { label: 'Karta',         Icon: CreditCard, color: 'text-blue-600 bg-blue-50 border-blue-200' },
  'bank transfer': { label: 'Bank',          Icon: Building2,  color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  transfer:        { label: 'Bank',          Icon: Building2,  color: 'text-indigo-600 bg-indigo-50 border-indigo-200' },
  barter:          { label: 'Barter',        Icon: Package,    color: 'text-amber-600 bg-amber-50 border-amber-200' },
};

function getMethodMeta(method) {
  return METHOD_META[method?.toLowerCase()] || {
    label: method || 'Noma\'lum',
    Icon: Wallet,
    color: 'text-gray-600 bg-gray-50 border-gray-200',
  };
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  }) + ' ' + d.toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' });
}

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

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function DebtProgressBar({ paidPercent, totalPaid, originalDebt, currentDebt, formatPrice }) {
  const clamp = Math.max(0, Math.min(100, paidPercent));
  const color = clamp >= 75 ? '#22c55e' : clamp >= 40 ? '#f59e0b' : '#ef4444';

  return (
    <div className="space-y-2">
      {/* Bar */}
      <div className="relative h-3 bg-subtle rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-700"
          style={{ width: `${clamp}%`, backgroundColor: color }}
        />
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-[700] text-emerald-600">
          ✓ {formatPrice(totalPaid)} to'langan ({clamp}%)
        </span>
        <span className="font-[600] text-state-danger-text">
          {formatPrice(currentDebt)} qoldi
        </span>
      </div>

      {/* Original debt */}
      {originalDebt > 0 && (
        <div className="text-[11px] text-tertiary text-center">
          Dastlabki nasiya: <span className="font-[600] text-secondary">{formatPrice(originalDebt)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Payment Item ─────────────────────────────────────────────────────────────
import { MoreVertical, Edit, Trash2 } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

function PaymentItem({ payment, formatPrice, index, onEdit, onDelete }) {
  const meta = getMethodMeta(payment.method);
  const { Icon, label, color } = meta;

  return (
    <div className="flex items-start gap-3 py-3 border-b border-subtle last:border-0 relative">
      {/* Index + Icon */}
      <div className="flex flex-col items-center gap-1 shrink-0 pt-0.5">
        <div className={`w-8 h-8 rounded-full border flex items-center justify-center ${color}`}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="text-[9px] font-[700] text-tertiary">#{index}</div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {/* Amount — asosiy */}
            <div className="text-[16px] font-[800] text-emerald-600 tracking-tight font-mono leading-none">
              + {formatPrice(payment.amount)}
            </div>
            {/* Method badge */}
            <span className={`text-[10px] font-[700] uppercase tracking-wider px-2 py-0.5 rounded-full border ${color}`}>
              {label}
            </span>
          </div>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-subtle text-tertiary hover:text-primary transition-colors">
                <MoreVertical className="w-4 h-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="min-w-[140px] bg-surface rounded-xl shadow-xl border border-subtle p-1 z-[60] animate-in fade-in zoom-in-95 duration-100"
              >
                <DropdownMenu.Item
                  onClick={() => onEdit(payment)}
                  className="flex items-center gap-2 px-2.5 py-2 text-[13px] font-[500] text-secondary hover:text-primary hover:bg-subtle rounded-lg cursor-pointer outline-none"
                >
                  <Edit className="w-4 h-4" />
                  Tahrirlash
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => onDelete(payment)}
                  className="flex items-center gap-2 px-2.5 py-2 text-[13px] font-[500] text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg cursor-pointer outline-none"
                >
                  <Trash2 className="w-4 h-4" />
                  O'chirish
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        {/* Date + Cashier */}
        <div className="mt-1 flex items-center gap-2 text-[11px] text-tertiary flex-wrap">
          <Clock className="w-3 h-3 shrink-0" />
          <span>{formatDate(payment.createdAt)}</span>
          {payment.receivedBy && (
            <>
              <span className="opacity-40">•</span>
              <span className="font-[500] text-secondary">{payment.receivedBy}</span>
            </>
          )}
        </div>

        {/* Notes */}
        {payment.notes && (
          <div className="mt-1 text-[11px] text-secondary bg-subtle rounded px-2 py-1 italic leading-tight">
            {payment.notes}
          </div>
        )}

        {/* Order number if linked */}
        {payment.order?.orderNumber && (
          <div className="mt-1 text-[10px] font-mono text-tertiary">
            Buyurtma: #{payment.order.orderNumber}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Filter Tabs ──────────────────────────────────────────────────────────────
const METHOD_FILTERS = [
  { value: 'all',   label: 'Barchasi' },
  { value: 'naqd',  label: 'Naqd',    aliases: ['cash'] },
  { value: 'karta', label: 'Karta',   aliases: ['card'] },
  { value: 'bank',  label: 'Bank',    aliases: ['bank transfer', 'transfer'] },
];

function matchFilter(payment, filter) {
  if (filter === 'all') return true;
  const m = payment.method?.toLowerCase() || '';
  const f = METHOD_FILTERS.find(x => x.value === filter);
  if (!f) return true;
  return m === f.value || (f.aliases || []).includes(m);
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────
import ConfirmModal from './ConfirmModal';
import EditPaymentModal from './EditPaymentModal';
import { useDeletePayment } from '../hooks/usePayments';

export default function DebtPaymentHistoryDrawer({ debtor, onClose }) {
  const { data, isLoading, error } = useCustomerPaymentHistory(debtor?._id);
  const { formatPrice } = useCurrency();
  const [methodFilter, setMethodFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [deletingPayment, setDeletingPayment] = useState(null);

  const deleteMutation = useDeletePayment();

  const payments = data?.data || [];

  const filtered = payments.filter(p => matchFilter(p, methodFilter));
  const SHOW_LIMIT = 10;
  const displayedPayments = showAll ? filtered : filtered.slice(0, SHOW_LIMIT);
  const hasMore = filtered.length > SHOW_LIMIT;

  const handleDelete = () => {
    if (deletingPayment) {
      deleteMutation.mutate(deletingPayment._id);
    }
  };

  // Summary stats per method
  const statsByMethod = {};
  payments.forEach(p => {
    const m = p.method?.toLowerCase() || 'other';
    if (!statsByMethod[m]) statsByMethod[m] = { count: 0, total: 0 };
    statsByMethod[m].count++;
    statsByMethod[m].total += p.amount;
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-[440px] bg-surface shadow-2xl z-50 flex flex-col">

        {/* ── Header ── */}
        <div className="px-5 py-4 border-b border-subtle shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[18px] font-[800] text-primary truncate leading-tight">
                {debtor?.name}
              </div>
              <div className="text-[12px] text-tertiary font-[500] mt-0.5">
                {debtor?.phone}
                {debtor?.type && (
                  <span className="ml-2 text-[10px] uppercase tracking-wider bg-subtle border border-subtle px-1.5 py-0.5 rounded">
                    {debtor.type === 'wholesale' ? 'Ulgurji' : 'Chakana'}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-surface border border-subtle flex items-center justify-center text-secondary hover:text-primary hover:bg-raised transition-all active:scale-95 shrink-0 mt-0.5"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>
        </div>

        {/* ── Scrollable Content ── */}
        <div className="flex-1 overflow-y-auto no-scrollbar">

          {/* ── Debt Progress Section ── */}
          <div className="px-5 py-4 border-b border-subtle bg-subtle/20">
            <div className="text-[11px] font-[700] uppercase tracking-wider text-tertiary mb-3">
              Qarz holati
            </div>

            {/* Katta raqamlar */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {/* Dastlabki */}
              <div className="bg-surface border border-subtle rounded-xl p-3 text-center">
                <div className="text-[10px] text-tertiary font-[600] uppercase tracking-wider mb-1">
                  Dastlabki
                </div>
                <div className="text-[13px] font-[800] text-primary font-mono leading-tight">
                  {formatPrice(debtor?.originalDebt || debtor?.totalDebt || 0)}
                </div>
              </div>
              {/* To'langan */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
                <div className="text-[10px] text-emerald-700 font-[600] uppercase tracking-wider mb-1">
                  To'langan
                </div>
                <div className="text-[13px] font-[800] text-emerald-700 font-mono leading-tight">
                  {formatPrice(debtor?.totalPaid || 0)}
                </div>
              </div>
              {/* Qoldi */}
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-center">
                <div className="text-[10px] text-red-600 font-[600] uppercase tracking-wider mb-1">
                  Qoldi
                </div>
                <div className="text-[13px] font-[800] text-red-600 font-mono leading-tight">
                  {formatPrice(debtor?.totalDebt || 0)}
                </div>
              </div>
            </div>

            {/* Progress Bar */}
            <DebtProgressBar
              paidPercent={debtor?.paidPercent || 0}
              totalPaid={debtor?.totalPaid || 0}
              originalDebt={debtor?.originalDebt || debtor?.totalDebt || 0}
              currentDebt={debtor?.totalDebt || 0}
              formatPrice={formatPrice}
            />

            {/* Status badge */}
            <div className="flex items-center gap-2 mt-3">
              {(debtor?.totalPaid || 0) === 0 ? (
                <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-[600]">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Hech qanday to'lov amalga oshirilmagan
                </div>
              ) : (debtor?.totalDebt || 0) === 0 ? (
                <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-[600]">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Qarz to'liq yopilgan
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-600 font-[600]">
                  <TrendingUp className="w-3.5 h-3.5" />
                  Qisman to'langan — {debtor?.paidPercent || 0}% yopilgan
                </div>
              )}
              {debtor?.lastPaymentDate && (
                <span className="ml-auto text-[10px] text-tertiary">
                  So'nggi: {timeAgo(debtor.lastPaymentDate)}
                </span>
              )}
            </div>
          </div>

          {/* ── Method Stats ── */}
          {Object.keys(statsByMethod).length > 0 && (
            <div className="px-5 py-3 border-b border-subtle">
              <div className="text-[11px] font-[700] uppercase tracking-wider text-tertiary mb-2">
                To'lov usullari bo'yicha
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(statsByMethod).map(([method, stat]) => {
                  const meta = getMethodMeta(method);
                  return (
                    <div
                      key={method}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-[600] ${meta.color}`}
                    >
                      <meta.Icon className="w-3 h-3" />
                      {meta.label}: {formatPrice(stat.total)} ({stat.count}×)
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Payment History List ── */}
          <div className="px-5 pt-4 pb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] font-[700] uppercase tracking-wider text-tertiary">
                To'lovlar tarixi
                {payments.length > 0 && (
                  <span className="ml-1.5 bg-accent/10 text-accent px-1.5 py-0.5 rounded-full text-[10px]">
                    {payments.length}
                  </span>
                )}
              </div>
            </div>

            {/* Method filter tabs */}
            {payments.length > 0 && (
              <div className="flex gap-1.5 mb-4 flex-wrap">
                {METHOD_FILTERS.map(f => {
                  const cnt = f.value === 'all'
                    ? payments.length
                    : payments.filter(p => matchFilter(p, f.value)).length;
                  if (cnt === 0 && f.value !== 'all') return null;
                  return (
                    <button
                      key={f.value}
                      onClick={() => { setMethodFilter(f.value); setShowAll(false); }}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-[600] border transition-all ${
                        methodFilter === f.value
                          ? 'bg-accent text-inverse border-transparent'
                          : 'bg-surface text-secondary border-subtle hover:bg-subtle'
                      }`}
                    >
                      {f.label}
                      <span className="ml-1 opacity-70">({cnt})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* List */}
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 rounded-xl bg-subtle animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <AlertCircle className="w-8 h-8 text-state-danger-text" />
                <div className="text-[13px] text-secondary">Ma'lumot yuklanmadi</div>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-subtle flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-tertiary" strokeWidth={1.5} />
                </div>
                <div className="text-[13px] font-[500] text-secondary">Hech qanday to'lov yo'q</div>
                <div className="text-[12px] text-tertiary">
                  {methodFilter === 'all'
                    ? 'Bu mijoz hali hech qanday to\'lov qilmagan'
                    : 'Bu usulda to\'lov amalga oshirilmagan'}
                </div>
              </div>
            ) : (
              <>
                {displayedPayments.map((payment, idx) => (
                  <PaymentItem
                    key={payment._id}
                    payment={payment}
                    formatPrice={formatPrice}
                    index={filtered.length - idx} // Teskari tartib — eng so'nggi #1
                    onEdit={setEditingPayment}
                    onDelete={setDeletingPayment}
                  />
                ))}

                {/* Show more / less */}
                {hasMore && (
                  <button
                    onClick={() => setShowAll(p => !p)}
                    className="w-full mt-3 py-2.5 rounded-xl border border-subtle text-[12px] font-[600] text-secondary hover:bg-subtle hover:text-primary transition-all flex items-center justify-center gap-2"
                  >
                    {showAll ? (
                      <>
                        <ChevronUp className="w-4 h-4" />
                        Kamroq ko'rsatish
                      </>
                    ) : (
                      <>
                        <ChevronDown className="w-4 h-4" />
                        Yana {filtered.length - SHOW_LIMIT} ta to'lovni ko'rish
                      </>
                    )}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <EditPaymentModal 
        isOpen={!!editingPayment} 
        onClose={() => setEditingPayment(null)} 
        payment={editingPayment} 
      />

      <ConfirmModal
        isOpen={!!deletingPayment}
        onClose={() => setDeletingPayment(null)}
        onConfirm={handleDelete}
        title="To'lovni o'chirish"
        message="Siz rostdan ham ushbu to'lovni o'chirmoqchimisiz? Bu amalni orqaga qaytarib bo'lmaydi va qarz miqdori qayta hisoblanadi."
        confirmText="O'chirish"
      />
    </>
  );
}

