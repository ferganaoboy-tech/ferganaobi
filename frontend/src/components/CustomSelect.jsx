import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const CustomSelect = ({ value, onChange, options, placeholder = 'Tanlang', className = '', disabled = false }) => {
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

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  return (
    <div className={`relative ${className} ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`} ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between bg-surface border border-subtle hover:border-default text-[13px] font-[500] text-primary rounded-lg px-3.5 py-2.5 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/10 group ${disabled ? 'pointer-events-none' : ''}`}
      >
        <span className={selectedOption ? 'text-primary truncate' : 'text-tertiary truncate'}>
          {selectedOption ? selectedOption.label : placeholder}
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
              const isSelected = String(opt.value) === String(value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-[13px] transition-all text-left rounded-lg
                    ${isSelected 
                      ? 'bg-app text-primary font-[600]' 
                      : 'text-secondary font-[500] hover:bg-subtle/50 hover:text-primary'
                    }
                  `}
                >
                  <span className="truncate pr-3">{opt.label}</span>
                  {isSelected && <Check className="w-4 h-4 text-primary shrink-0" strokeWidth={2.5} />}
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
