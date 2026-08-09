import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Grid3X3, 
  Hash, 
  Tag, 
  Scale, 
  AlertTriangle,
  Clock,
  CheckCircle,
  PackageCheck,
  XCircle,
  Banknote,
  TrendingUp,
  Eye,
  EyeOff
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

import StatsCard from '../components/StatsCard';
import { useDashboardStats } from '../hooks/useProducts';
import { useOrders, useOrderStats } from '../hooks/useOrders';
import { useDebtors } from '../hooks/useCustomers';
import { formatUZS, formatShort, formatQuantity } from '../utils/format';

const Dashboard = () => {
  const navigate = useNavigate();
  const { data: statsRes, isLoading: statsLoading } = useDashboardStats();
  const { data: ordersRes, isLoading: ordersLoading } = useOrders({ limit: 5 });
  const { data: orderStatsRes, isLoading: orderStatsLoading } = useOrderStats();
  const { data: debtorsRes, isLoading: debtorsLoading } = useDebtors();

  const [period, setPeriod] = useState('30 kun');
  const [showFinancials, setShowFinancials] = useState(false);

  const stats = statsRes?.data;
  const recentOrders = ordersRes?.data || [];
  const orderStats = orderStatsRes?.data;
  const totalDebt = debtorsRes?.data?.reduce((sum, d) => sum + d.totalDebt, 0) || 0;

  // Real data for AreaChart based on dailySales
  const areaChartData = React.useMemo(() => {
    if (!orderStats?.dailySales || orderStats.dailySales.length === 0) {
      return [];
    }
    return orderStats.dailySales.map(item => {
      // item._id is like "2026-06-05"
      const date = new Date(item._id);
      return {
        name: date.getDate().toString(), // just the day of the month
        amount: item.total
      };
    });
  }, [orderStats?.dailySales]);

  if (statsLoading || ordersLoading || debtorsLoading || orderStatsLoading) {
    return (
      <div id="tour-stats" className="p-[32px_40px] flex items-center justify-center h-full">
        <div className="w-full h-full animate-shimmer rounded-lg"></div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-surface border border-default p-3 rounded-md shadow-none">
          <p className="text-12 text-tertiary mb-1">Kun {label}</p>
          <p className="text-13 font-[600] text-primary">{formatUZS(payload[0].value)}</p>
        </div>
      );
    }
    return null;
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending': return <Clock className="w-[14px] h-[14px] text-state-warning-text" strokeWidth={1.5} />;
      case 'confirmed': return <CheckCircle className="w-[14px] h-[14px] text-state-info-text" strokeWidth={1.5} />;
      case 'delivered': return <PackageCheck className="w-[14px] h-[14px] text-state-success-text" strokeWidth={1.5} />;
      case 'cancelled': return <XCircle className="w-[14px] h-[14px] text-state-danger-text" strokeWidth={1.5} />;
      default: return null;
    }
  };

  return (
    <div className="p-2 sm:p-[32px_40px] max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-[32px]">
        <div>
          <h1 className="text-24 sm:text-28 font-[600] tracking-[-0.03em] text-primary flex items-center gap-3">
            Dashboard
            <button 
              onClick={() => setShowFinancials(!showFinancials)}
              className="p-1.5 rounded-lg border border-subtle bg-surface text-tertiary hover:text-primary transition-colors active:scale-95"
              title={showFinancials ? "Moliyaviy ma'lumotlarni yashirish" : "Moliyaviy ma'lumotlarni ko'rsatish"}
            >
              {showFinancials ? <EyeOff className="w-[18px] h-[18px]" strokeWidth={2} /> : <Eye className="w-[18px] h-[18px]" strokeWidth={2} />}
            </button>
          </h1>
          <p className="text-13 sm:text-14 text-secondary mt-1">Umumiy ko'rsatkichlar va oxirgi o'zgarishlar.</p>
        </div>
      </div>

      {/* Row 1: Stats Strip (6 columns responsive) */}
      <div id="tour-stats" className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatsCard 
          title="Umumiy savdo" 
          value={showFinancials ? formatShort(orderStats?.totalRevenue || 0) : '***'} 
          icon={Banknote} 
        />
        <StatsCard 
          title="Sof foyda" 
          value={showFinancials ? formatShort(orderStats?.totalProfit || 0) : '***'} 
          icon={TrendingUp} 
        />
        <StatsCard 
          title="Jami mahsulot" 
          value={formatShort(stats?.totalProducts || 0)} 
          icon={Grid3X3} 
        />
        <StatsCard 
          title="Jami Zaxira" 
          value={formatShort(stats?.totalRolls || 0)} 
          icon={Hash} 
        />
        <StatsCard 
          title="Inventar qiymati" 
          value={showFinancials ? formatShort(stats?.totalValue || 0) : '***'} 
          icon={Tag} 
        />
        <StatsCard 
          title="Jami qarz" 
          value={showFinancials ? formatShort(totalDebt) : '***'} 
          icon={Scale}
          isDanger={totalDebt > 0}
        />
      </div>

      {/* Row 1.5: Skladlar bo'yicha statistika */}
      {(() => {
        const warehouseMap = new Map();
        stats?.warehouseStats?.forEach(ws => {
          warehouseMap.set(ws._id, { ...ws, revenue: 0 });
        });
        orderStats?.revenueByWarehouse?.forEach(rw => {
          if (warehouseMap.has(rw._id)) {
            warehouseMap.get(rw._id).revenue = rw.total;
          } else {
            warehouseMap.set(rw._id, { 
              _id: rw._id, 
              name: rw.name || 'Noma\'lum sklad', 
              color: rw.color,
              totalProducts: 0,
              totalRolls: 0,
              totalValue: 0,
              totalRetailValue: 0,
              expectedProfit: 0,
              revenue: rw.total
            });
          }
        });
        const mergedWarehouses = Array.from(warehouseMap.values());

        if (mergedWarehouses.length === 0) return null;

        return (
          <div className="mb-6 sm:mb-8">
            <h3 className="text-16 font-[600] text-primary mb-4 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-indigo-500" /> Skladlar bo'yicha ko'rsatkichlar
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {mergedWarehouses.map(ws => (
                <div key={ws._id} className="bg-surface border border-subtle rounded-2xl p-5 shadow-sm hover:border-default transition-all group">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border border-subtle group-hover:scale-105 transition-transform" style={{ backgroundColor: `${ws.color || '#4f46e5'}15`, color: ws.color || '#4f46e5' }}>
                      <Hash className="w-5 h-5" />
                    </div>
                    <h4 className="text-15 font-[600] text-primary truncate">{ws.name}</h4>
                  </div>
                  <div className="flex flex-col gap-2.5">
                    <div className="flex justify-between items-center border-b border-subtle pb-2.5">
                      <span className="text-12 font-[500] text-secondary">Umumiy savdo:</span>
                      <span className="text-13 font-[700] text-primary">{showFinancials ? formatUZS(ws.revenue) : '***'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-subtle pb-2.5">
                      <span className="text-12 font-[500] text-secondary">Jami Zaxira:</span>
                      <span className="text-13 font-[600] text-primary">{formatShort(ws.totalRolls)} ta</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-subtle pb-2.5">
                      <span className="text-12 font-[500] text-secondary">Maxsulot xili:</span>
                      <span className="text-13 font-[600] text-primary">{formatShort(ws.totalProducts)} xil</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-subtle pb-2.5">
                      <span className="text-12 font-[500] text-secondary">Inventar qiymati:</span>
                      <span className="text-13 font-[600] text-primary">{showFinancials ? formatUZS(ws.totalValue) : '***'}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-subtle pt-0.5 pb-2.5">
                      <span className="text-12 font-[500] text-secondary" title="Jami yuborilgan tovarlar tarixi">Jami yuborilgan:</span>
                      <span className="text-13 font-[600] text-primary">{ws.totalSentQuantity || 0} ta</span>
                    </div>
                    <div className="flex justify-between items-center pt-0.5">
                      <span className="text-12 font-[500] text-secondary" title="Jami qabul qilingan tovarlar tarixi">Jami qabul qilindi:</span>
                      <span className="text-13 font-[600] text-primary">{ws.totalReceivedQuantity || 0} ta</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Row 2: Content (Sales chart hidden for now) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[360px]">
        {/* Low stock alerts */}
        <div className="flex flex-col min-h-0 bg-surface border border-subtle p-5 rounded-2xl shadow-sm">
          <h3 className="text-15 font-[600] text-primary mb-4 flex items-center gap-2">
            Kam qolgan
            {stats?.lowStockItems?.length > 0 && (
              <span className="bg-state-warning-bg text-state-warning-text border border-state-warning-border px-2 py-0.5 rounded text-11 font-[500]">
                {stats.lowStockItems.length}
              </span>
            )}
          </h3>
          <div className="flex-1 lg:overflow-y-auto overflow-visible no-scrollbar lg:pr-2">
            {stats?.lowStockItems?.length === 0 ? (
              <div className="h-full flex items-center justify-center text-13 text-tertiary">
                Muammo yo'q
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {stats?.lowStockItems?.map(item => (
                  <li key={item._id} className="p-3 border border-subtle bg-app rounded-xl flex items-center justify-between group hover:border-default transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-state-warning-bg flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-[14px] h-[14px] text-state-warning-text" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-13 font-[600] text-primary truncate">
                          {item.name || (item.brand ? `${item.brand} — ${item.artikul}` : item.artikul)}
                        </div>
                        <div className="text-11 text-tertiary truncate mt-0.5">{item.warehouse?.name}</div>
                      </div>
                    </div>
                    <div className="shrink-0 ml-3 flex items-center gap-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate('/products', { state: { search: item.artikul } });
                        }}
                        className="w-7 h-7 rounded-md flex items-center justify-center text-tertiary hover:text-primary hover:bg-subtle transition-all"
                        title="Mahsulotni ko'rish"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <span className="text-12 font-[600] text-state-danger-text bg-state-danger-bg px-2.5 py-1 rounded-md">
                        {formatQuantity(item.quantity, item.rollLength)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Recent orders */}
        <div className="flex flex-col min-h-0 bg-surface border border-subtle p-5 rounded-2xl shadow-sm">
          <h3 className="text-15 font-[600] text-primary mb-4">Oxirgi buyurtmalar</h3>
          <div className="flex-1 lg:overflow-y-auto overflow-visible no-scrollbar lg:pr-2">
            {recentOrders.length === 0 ? (
              <div className="h-full flex items-center justify-center text-13 text-tertiary">
                Buyurtmalar yo'q
              </div>
            ) : (
              <ul className="flex flex-col gap-2">
                {recentOrders.map(order => (
                  <li key={order._id} className="p-3 border border-subtle bg-app rounded-xl flex items-center justify-between group hover:border-default transition-colors">
                    <div className="flex flex-col min-w-0 pr-3">
                      <div className="text-13 font-[600] text-primary truncate">{order.customer?.name}</div>
                      <div className="text-12 font-mono text-tertiary mt-0.5">{order.orderNumber}</div>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <div className="text-14 font-[700] text-primary">{showFinancials ? formatUZS(order.totalAmount) : '***'}</div>
                      <div className="mt-1.5 flex items-center gap-1 text-11 text-secondary font-[500] bg-surface px-1.5 py-0.5 rounded border border-subtle">
                        {getStatusIcon(order.status)}
                        <span className="uppercase tracking-wider text-[10px]">{order.status}</span>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
