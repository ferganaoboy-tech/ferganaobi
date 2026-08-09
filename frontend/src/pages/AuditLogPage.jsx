import React, { useState } from 'react';
import { useAuditLogs } from '../hooks/useAuditLogs';
import { History, Search, Filter } from 'lucide-react';
import { formatDate } from '../utils/format';
import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { BounceLoader } from 'react-spinners';
import CustomSelect from '../components/CustomSelect';

const AuditLogPage = () => {
  const { user } = useAuth();
  
  // Guard for superadmin/admin
  if (user && !['superadmin', 'admin'].includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  const [filters, setFilters] = useState({
    page: 1,
    action: '',
    entity: ''
  });

  const { data: logsRes, isLoading } = useAuditLogs(filters);
  const logs = logsRes?.data || [];
  const pagination = logsRes?.pagination;

  const handleFilterChange = (e) => {
    setFilters(prev => ({ ...prev, [e.target.name]: e.target.value, page: 1 }));
  };

  const renderActionBadge = (action) => {
    const badges = {
      CREATE: 'bg-state-success-bg text-state-success-text border-state-success-border',
      UPDATE: 'bg-state-warning-bg text-state-warning-text border-state-warning-border',
      DELETE: 'bg-state-danger-bg text-state-danger-text border-state-danger-border',
      LOGIN: 'bg-state-info-bg text-state-info-text border-state-info-border',
      PAYMENT: 'bg-state-success-bg text-state-success-text border-state-success-border',
      RETURN: 'bg-state-danger-bg text-state-danger-text border-state-danger-border',
      START_SHIFT: 'bg-accent/10 text-accent border-accent/20',
      CLOSE_SHIFT: 'bg-state-danger-bg text-state-danger-text border-state-danger-border',
      SYSTEM: 'bg-state-neutral-bg text-state-neutral-text border-state-neutral-border'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-[10px] font-[600] border ${badges[action] || badges.SYSTEM}`}>
        {action}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full p-2 sm:p-[32px_40px]">
      <div className="flex items-center justify-between mb-[24px] shrink-0">
        <div>
          <h1 className="text-28 font-[600] tracking-[-0.03em] text-primary flex items-center gap-3">
            <History className="w-7 h-7 text-accent" strokeWidth={1.5} />
            Harakatlar tarixi (Audit)
          </h1>
          <p className="text-14 text-secondary mt-1">Tizimdagi barcha o'zgarishlar va harakatlar</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center mb-[24px] shrink-0 relative z-20">
        <div className="relative shrink-0 w-full sm:w-[180px]">
          <CustomSelect
            value={filters.action || ''}
            onChange={(val) => handleFilterChange({ target: { name: 'action', value: val } })}
            options={[
              { value: '', label: 'Barcha harakatlar' },
              { value: 'CREATE', label: 'Yaratish' },
              { value: 'UPDATE', label: 'Tahrirlash' },
              { value: 'DELETE', label: 'O\'chirish' },
              { value: 'LOGIN', label: 'Tizimga kirish' },
              { value: 'PAYMENT', label: 'To\'lov' },
              { value: 'RETURN', label: 'Vozvrat' },
              { value: 'START_SHIFT', label: 'Smenani ochish' },
              { value: 'CLOSE_SHIFT', label: 'Smenani yopish' }
            ]}
          />
        </div>

        <div className="relative shrink-0 w-full sm:w-[180px]">
          <CustomSelect
            value={filters.entity || ''}
            onChange={(val) => handleFilterChange({ target: { name: 'entity', value: val } })}
            options={[
              { value: '', label: 'Barcha bo\'limlar' },
              { value: 'Product', label: 'Maxsulotlar' },
              { value: 'Order', label: 'Buyurtmalar' },
              { value: 'Customer', label: 'Mijozlar' },
              { value: 'Payment', label: 'To\'lovlar' },
              { value: 'Return', label: 'Vozvratlar' },
              { value: 'Shift', label: 'Smenalar' },
              { value: 'Settings', label: 'Sozlamalar' }
            ]}
          />
        </div>
      </div>

      {/* Logs Table */}
      <div className="flex-1 border border-subtle bg-surface rounded-2xl overflow-hidden flex flex-col shadow-sm">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <BounceLoader color="var(--accent-primary)" size={40} />
            <span className="text-13 text-secondary animate-pulse font-[500]">Yuklanmoqda...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-secondary">Ma'lumot topilmadi</div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto no-scrollbar bg-app md:bg-transparent p-2 md:p-0">
              
              {/* Desktop Table */}
              <div className="hidden md:block">
                <table className="w-full text-left text-13">
                  <thead className="sticky top-0 bg-subtle border-b border-subtle z-10">
                    <tr className="text-11 font-[500] text-tertiary uppercase tracking-[0.06em]">
                      <th className="px-4 py-3">Sana / Vaqt</th>
                      <th className="px-4 py-3">Xodim</th>
                      <th className="px-4 py-3">Harakat</th>
                      <th className="px-4 py-3">Bo'lim</th>
                      <th className="px-4 py-3">Batafsil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id} className="border-b border-subtle hover:bg-raised transition-colors group">
                        <td className="px-4 py-3 whitespace-nowrap text-12 font-mono text-secondary">
                          {new Date(log.createdAt).toLocaleString('ru-RU')}
                        </td>
                        <td className="px-4 py-3 font-[500] text-primary">{log.userName}</td>
                        <td className="px-4 py-3">{renderActionBadge(log.action)}</td>
                        <td className="px-4 py-3 text-secondary">{log.entity}</td>
                        <td className="px-4 py-3 text-primary max-w-md truncate" title={log.details}>
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden flex flex-col gap-2">
                {logs.map((log) => (
                  <div key={log._id} className="bg-surface border border-subtle rounded-xl p-3 shadow-sm flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[14px] font-[600] text-primary">{log.userName}</span>
                      {renderActionBadge(log.action)}
                    </div>
                    <div className="flex items-center justify-between text-12">
                      <span className="text-secondary font-mono">{new Date(log.createdAt).toLocaleString('ru-RU')}</span>
                      <span className="text-tertiary px-2 py-0.5 bg-subtle rounded-md">Bo'lim: {log.entity}</span>
                    </div>
                    {log.details && (
                      <div className="mt-1 pt-2 border-t border-subtle text-[13px] text-primary leading-relaxed">
                        {log.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
            
            {/* Pagination controls could be added here */}
            {pagination && pagination.pages > 1 && (
              <div className="h-12 border-t border-subtle px-4 flex items-center justify-between bg-subtle shrink-0">
                <span className="text-12 text-secondary">
                  Jami: {pagination.total} ta yozuv
                </span>
                <div className="flex gap-2">
                  <button 
                    disabled={filters.page === 1}
                    onClick={() => setFilters(prev => ({...prev, page: prev.page - 1}))}
                    className="px-3 py-1 bg-surface border border-default rounded text-12 disabled:opacity-50"
                  >
                    Oldingi
                  </button>
                  <button 
                    disabled={filters.page === pagination.pages}
                    onClick={() => setFilters(prev => ({...prev, page: prev.page + 1}))}
                    className="px-3 py-1 bg-surface border border-default rounded text-12 disabled:opacity-50"
                  >
                    Keyingi
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AuditLogPage;
