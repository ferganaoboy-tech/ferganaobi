import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const CustomSelect = ({ value, onChange, options, placeholder = 'Tanlang', className = '', disabled = false, multiple = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getDisplayValue = () => {
    if (multiple) {
      if (!value || value.length === 0) return placeholder;
      // Agar bo'sh value ('Umumiy qarzdan uzish') ham bo'lsa
      if (value.includes('')) return 'Umumiy qarzdan uzish';
      
      const selectedLabels = options
        .filter(opt => value.includes(opt.value))
        .map(opt => opt.label);
      return selectedLabels.length === 1 
        ? selectedLabels[0] 
        : `${selectedLabels.length} ta tanlandi`;
    } else {
      const selectedOption = options.find(opt => String(opt.value) === String(value));
      return selectedOption ? selectedOption.label : placeholder;
    }
  };

  const handleSelect = (optValue) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      if (optValue === '') {
        // Agar 'Umumiy qarzdan uzish' tanlansa, boshqalarini tozalash kerak
        onChange(['']);
        setIsOpen(false);
        return;
      }
      
      let newValues;
      if (currentValues.includes(optValue)) {
        newValues = currentValues.filter(v => v !== optValue && v !== '');
      } else {
        newValues = [...currentValues.filter(v => v !== ''), optValue];
      }
      // Agar hammasi o'chib ketsa, default bo'sh massiv emas, balki umumiy qarz bo'lishi mumkin
      onChange(newValues.length > 0 ? newValues : ['']);
    } else {
      onChange(optValue);
      setIsOpen(false);
    }
  };

  const isSelected = (optValue) => {
    if (multiple) {
      return Array.isArray(value) && value.includes(optValue);
    }
    return String(optValue) === String(value);
  };

  return (
    <div className={`relative ${className} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-surface border border-subtle hover:border-default text-[13px] font-[500] text-primary rounded-lg px-3.5 py-2.5 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10 group ${disabled ? 'pointer-events-none' : ''}`}
      >
        <span className={(!multiple && value !== '') || (multiple && value?.length > 0 && !value.includes('')) ? 'text-primary truncate' : 'text-tertiary truncate'}>
          {getDisplayValue()}
        </span>
        <ChevronDown 
          className={`w-4 h-4 text-tertiary transition-transform duration-200 shrink-0 ml-3 group-hover:text-primary ${isOpen ? 'rotate-180' : ''}`} 
          strokeWidth={2}
        />
      </button>

      {isOpen && (
        <div className="absolute z-[100] top-full mt-1.5 w-full min-w-[180px] bg-surface border border-subtle rounded-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.4)] overflow-hidden animate-fade-in origin-top">
          <div className="max-h-[260px] overflow-y-auto no-scrollbar p-1">
            {options.map((opt) => {
              const selected = isSelected(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-[13px] transition-all text-left rounded-lg
                    ${selected 
                      ? 'bg-app text-primary font-[600]' 
                      : 'text-secondary font-[500] hover:bg-subtle/50 hover:text-primary'
                    }
                  `}
                >
                  <span className="truncate pr-3">{opt.label}</span>
                  {selected && <Check className="w-4 h-4 text-primary shrink-0" strokeWidth={2.5} />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSelect;
