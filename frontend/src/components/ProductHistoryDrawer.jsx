import React, { useState } from 'react';
import {
  X, ShoppingBag, RotateCcw, ArrowLeftRight,
  Package, TrendingUp, TrendingDown, Layers,
  ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';
import { useProductHistory } from '../hooks/useProducts';
import { useCurrency } from '../contexts/CurrencyContext';

const TYPE_LABELS = {
  order:    { label: 'Sotuv',    color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', Icon: ShoppingBag },
  return:   { label: 'Vozvrat', color: 'text-red-500',     bg: 'bg-red-50 border-red-200',         Icon: RotateCcw },
  transfer: { label: 'Transfer', color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200',        Icon: ArrowLeftRight },
};

const STATUS_LABELS = {
  confirmed: { label: 'Tasdiqlangan', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  delivered: { label: 'Yetkazilgan',  color: 'text-indigo-700 bg-indigo-50 border-indigo-200'   },
  pending:   { label: 'Kutmoqda',     color: 'text-amber-700 bg-amber-50 border-amber-200'       },
  completed: { label: 'Bajarildi',    color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
  requested: { label: 'So\'rov',      color: 'text-amber-700 bg-amber-50 border-amber-200'       },
  rejected:  { label: 'Rad etildi',  color: 'text-red-700 bg-red-50 border-red-200'             },
  cancelled: { label: 'Bekor',        color: 'text-gray-600 bg-gray-50 border-gray-200'          },
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('uz-UZ', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function SummaryCard({ icon: Icon, label, value, color }) {
  return (
    <div className="flex flex-col items-center justify-center bg-surface border border-subtle rounded-xl p-3 gap-1 min-w-0">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center mb-0.5 ${color}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="text-[16px] font-[800] text-primary leading-none">{value}</div>
      <div className="text-[10px] text-tertiary font-[500] text-center leading-tight">{label}</div>
    </div>
  );
}

function HistoryItem({ event, formatPrice }) {
  const [expanded, setExpanded] = useState(false);
  const meta = TYPE_LABELS[event.type] || TYPE_LABELS.order;
  const { Icon, label, color, bg } = meta;

  return (
    <div className="bg-surface border border-subtle rounded-xl overflow-hidden mb-2">
      {/* Header row */}
      <button
        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-subtle/40 transition-colors"
        onClick={() => setExpanded(p => !p)}
      >
        {/* Type badge */}
        <div className={`w-8 h-8 rounded-full border flex items-center justify-center shrink-0 ${bg}`}>
          <Icon className={`w-3.5 h-3.5 ${color}`} />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[11px] font-[700] uppercase tracking-wider ${color}`}>{label}</span>
            {event.orderNumber && (
              <span className="text-[11px] text-tertiary font-mono">#{event.orderNumber}</span>
            )}
            {event.returnNumber && (
              <span className="text-[11px] text-tertiary font-mono">#{event.returnNumber}</span>
            )}
            {event.transferNumber && (
              <span className="text-[11px] text-tertiary font-mono">#{event.transferNumber}</span>
            )}
            {/* Status badge */}
            {event.status && STATUS_LABELS[event.status] && (
              <span className={`text-[10px] font-[600] px-1.5 py-0.5 rounded border ${STATUS_LABELS[event.status].color}`}>
                {STATUS_LABELS[event.status].label}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-[12px] text-tertiary">
            <span>{formatDate(event.date)}</span>
            {event.customer?.name && (
              <>
                <span className="text-subtle">•</span>
                <span className="truncate font-[500] text-secondary">{event.customer.name}</span>
              </>
            )}
          </div>
        </div>

        {/* Quantity & Amount */}
        <div className="flex flex-col items-end shrink-0 mr-1">
          <span className="text-[14px] font-[700] text-primary">
            {event.type === 'transfer'
              ? `${event.quantity} ${event.unit}`
              : `${event.quantityInRolls || event.quantity} ${event.unit}`}
          </span>
          {event.subtotal > 0 && (
            <span className="text-[11px] text-emerald-600 font-[600]">
              {formatPrice(event.subtotal)}
            </span>
          )}
          {event.refundAmount > 0 && (
            <span className="text-[11px] text-red-500 font-[600]">
              -{formatPrice(event.refundAmount)}
            </span>
          )}
        </div>

        {expanded ? (
          <ChevronUp className="w-4 h-4 text-tertiary shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-tertiary shrink-0" />
        )}
      </button>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-subtle bg-subtle/20">
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            {/* Order details */}
            {event.type === 'order' && (
              <>
                {event.unitPrice > 0 && (
                  <div>
                    <div className="text-tertiary mb-0.5">Birlik narxi</div>
                    <div className="font-[600] text-primary">{formatPrice(event.unitPrice)}</div>
                  </div>
                )}
                {event.discount > 0 && (
                  <div>
                    <div className="text-tertiary mb-0.5">Chegirma</div>
                    <div className="font-[600] text-amber-600">{event.discount}%</div>
                  </div>
                )}
                {event.paymentType && (
                  <div>
                    <div className="text-tertiary mb-0.5">To'lov turi</div>
                    <div className="font-[600] text-primary capitalize">{event.paymentType}</div>
                  </div>
                )}
                {event.returnedQuantity > 0 && (
                  <div>
                    <div className="text-tertiary mb-0.5">Qaytarilgan</div>
                    <div className="font-[600] text-red-600">{event.returnedQuantity} {event.unit}</div>
                  </div>
                )}
                {event.warehouse?.name && (
                  <div>
                    <div className="text-tertiary mb-0.5">Ombor</div>
                    <div className="font-[600] text-primary flex items-center gap-1">
                      {event.warehouse.color && (
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: event.warehouse.color }} />
                      )}
                      {event.warehouse.name}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Return details */}
            {event.type === 'return' && (
              <>
                {event.reason && (
                  <div className="col-span-2">
                    <div className="text-tertiary mb-0.5">Sabab</div>
                    <div className="font-[500] text-primary">{event.reason}</div>
                  </div>
                )}
                {event.processedBy && (
                  <div>
                    <div className="text-tertiary mb-0.5">Qaytargan</div>
                    <div className="font-[600] text-primary">{event.processedBy}</div>
                  </div>
                )}
                {event.order?.orderNumber && (
                  <div>
                    <div className="text-tertiary mb-0.5">Asosiy buyurtma</div>
                    <div className="font-[600] text-primary font-mono">#{event.order.orderNumber}</div>
                  </div>
                )}
              </>
            )}

            {/* Transfer details */}
            {event.type === 'transfer' && (
              <>
                {event.fromWarehouse?.name && (
                  <div>
                    <div className="text-tertiary mb-0.5">Kimdan</div>
                    <div className="font-[600] text-primary flex items-center gap-1">
                      {event.fromWarehouse.color && (
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: event.fromWarehouse.color }} />
                      )}
                      {event.fromWarehouse.name}
                    </div>
                  </div>
                )}
                {event.toWarehouse?.name && (
                  <div>
                    <div className="text-tertiary mb-0.5">Kimga</div>
                    <div className="font-[600] text-primary flex items-center gap-1">
                      {event.toWarehouse.color && (
                        <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: event.toWarehouse.color }} />
                      )}
                      {event.toWarehouse.name}
                    </div>
                  </div>
                )}
                {event.sentBy?.name && (
                  <div>
                    <div className="text-tertiary mb-0.5">Yuboruvchi</div>
                    <div className="font-[600] text-primary">{event.sentBy.name}</div>
                  </div>
                )}
                <div>
                  <div className="text-tertiary mb-0.5">Tur</div>
                  <div className="font-[600] text-primary capitalize">
                    {event.transferType === 'request' ? 'So\'rov' : 'Yuborish'}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const FILTER_OPTIONS = [
  { value: 'all',      label: 'Barchasi' },
  { value: 'order',    label: 'Sotuvlar' },
  { value: 'return',   label: 'Vozvratlar' },
  { value: 'transfer', label: 'Transferlar' },
];

export default function ProductHistoryDrawer({ productId, onClose }) {
  const { data, isLoading, error } = useProductHistory(productId);
  const { formatPrice } = useCurrency();
  const [filter, setFilter] = useState('all');

  const { product, summary, history = [] } = data?.data || {};

  const filtered = filter === 'all' ? history : history.filter(e => e.type === filter);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-background shadow-2xl z-50 flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-subtle shrink-0">
          <div className="min-w-0 mr-3">
            <div className="text-[17px] font-[800] text-primary truncate">
              {product?.artikul || '...'}
            </div>
            <div className="text-[12px] text-tertiary font-[500] uppercase tracking-wider">
              {product?.brand || ''}{product?.collection ? ` · ${product.collection}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-subtle flex items-center justify-center text-tertiary hover:text-primary transition-colors shrink-0"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-16 rounded-xl bg-subtle animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <AlertCircle className="w-10 h-10 text-state-danger-text" />
              <div className="text-[14px] text-secondary font-[500]">Ma'lumot yuklanmadi</div>
              <div className="text-[12px] text-tertiary">{error.message}</div>
            </div>
          ) : (
            <>
              {/* Summary cards */}
              {summary && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <SummaryCard
                    icon={TrendingUp}
                    label="Jami sotilgan"
                    value={`${summary.totalSoldRolls} ${product?.unit || 'rulon'}`}
                    color="bg-emerald-100 text-emerald-600"
                  />
                  <SummaryCard
                    icon={TrendingDown}
                    label="Qaytarilgan"
                    value={`${summary.totalReturnedRolls} ${product?.unit || 'rulon'}`}
                    color="bg-red-100 text-red-500"
                  />
                  <SummaryCard
                    icon={Layers}
                    label="Net sotilgan"
                    value={`${summary.netSoldRolls} ${product?.unit || 'rulon'}`}
                    color="bg-indigo-100 text-indigo-600"
                  />
                </div>
              )}

              {/* Revenue summary */}
              {summary?.totalRevenue > 0 && (
                <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 mb-4">
                  <div className="text-[12px] text-emerald-700 font-[600]">Jami tushum (ushbu mahsulotdan)</div>
                  <div className="text-[16px] font-[800] text-emerald-700">
                    {formatPrice(summary.totalRevenue)}
                  </div>
                </div>
              )}

              {/* Filter tabs */}
              <div className="flex gap-1.5 mb-4 flex-wrap">
                {FILTER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-[600] border transition-all ${
                      filter === opt.value
                        ? 'bg-accent text-inverse border-transparent'
                        : 'bg-surface text-secondary border-subtle hover:bg-subtle'
                    }`}
                  >
                    {opt.label}
                    {opt.value !== 'all' && (
                      <span className="ml-1 opacity-70">
                        ({history.filter(e => e.type === opt.value).length})
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* History list */}
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                  <Package className="w-10 h-10 text-tertiary" strokeWidth={1.5} />
                  <div className="text-[14px] text-secondary font-[500]">Hech qanday yozuv yo'q</div>
                  <div className="text-[12px] text-tertiary">Bu mahsulot uchun hali harakat amalga oshirilmagan</div>
                </div>
              ) : (
                <div>
                  {filtered.map((event, idx) => (
                    <HistoryItem
                      key={`${event.type}-${event.id}-${idx}`}
                      event={event}
                      formatPrice={formatPrice}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
