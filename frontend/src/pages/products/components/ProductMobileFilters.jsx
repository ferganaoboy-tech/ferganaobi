import React from 'react';
import CustomSelect from '../../../components/CustomSelect';

const ProductMobileFilters = ({
  showMobileFilters,
  filters,
  setFilters,
  handleFilterChange,
  warehouses,
  filterOptions,
  user
}) => {
  if (!showMobileFilters) return null;

  return (
    <div className="bg-surface border border-subtle rounded-2xl p-4 sm:p-5 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 shrink-0 animate-in slide-in-from-top-4 duration-200 shadow-sm">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-[600] text-secondary uppercase tracking-wider pl-1">Sklad</label>
        <CustomSelect
          value={filters.warehouse || 'all'}
          onChange={(val) => handleFilterChange({ target: { name: 'warehouse', value: val } })}
          options={[
            { value: 'all', label: 'Barcha Skladlar' },
            ...warehouses.map(wh => ({ value: wh._id, label: wh.name }))
          ]}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-[600] text-secondary uppercase tracking-wider pl-1">Brend</label>
        <CustomSelect
          value={filters.brand || ''}
          onChange={(val) => handleFilterChange({ target: { name: 'brand', value: val } })}
          options={[
            { value: '', label: 'Barchasi' },
            ...(filterOptions.brands || []).map(b => ({ value: b, label: b }))
          ]}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-[600] text-secondary uppercase tracking-wider pl-1">Turkum</label>
        <CustomSelect
          value={filters.category || ''}
          onChange={(val) => handleFilterChange({ target: { name: 'category', value: val } })}
          options={[
            { value: '', label: 'Barchasi' },
            { value: 'oboi', label: 'Oboi' },
            { value: 'lyustra', label: 'Lyustra' },
            { value: 'laminat', label: 'Laminat' }
          ]}
        />
      </div>
      
      {[
        filters.warehouse && filters.warehouse !== 'all' ? 'warehouse' : '',
        filters.brand
      ].filter(Boolean).length > 0 && (
        <div className="col-span-1 sm:col-span-2 lg:col-span-3 flex justify-end">
          <button 
            onClick={() => setFilters({
              search: filters.search,
              warehouse: (user?.role !== 'superadmin' && user?.role !== 'admin' && user?.warehouse) ? (user.warehouse._id || user.warehouse) : 'all',
              category: '',
              brand: '',
              country: '',
              color: '',
              lowStock: false,
              deadStock: false,
              sortBy: 'popular',
            })}
            className="text-12 font-[500] text-secondary hover:text-state-danger-text transition-colors flex items-center gap-1"
            type="button"
          >
            Filtrlar tozalash
          </button>
        </div>
      )}
    </div>
  );
};

export default ProductMobileFilters;
