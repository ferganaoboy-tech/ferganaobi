import React from 'react';

const StatsCard = ({ title, value, icon: Icon, subtitle, isDanger }) => {
  return (
    <div className="bg-surface border border-subtle rounded-md p-3 sm:p-5 flex flex-col justify-between h-full">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-tertiary text-11 sm:text-12 font-[500] mb-1 sm:mb-2 truncate">{title}</p>
          <h3 className={`text-18 sm:text-24 font-[600] tracking-tight truncate ${isDanger ? 'text-state-danger-text' : 'text-primary'}`}>
            {value}
          </h3>
        </div>
        <div className="shrink-0 mt-0.5 sm:mt-0">
          <Icon className="w-[14px] h-[14px] sm:w-[16px] sm:h-[16px] text-tertiary" strokeWidth={1.5} />
        </div>
      </div>
      {subtitle && (
        <div className="mt-2 sm:mt-3 text-11 sm:text-12 text-secondary truncate">
          {subtitle}
        </div>
      )}
    </div>
  );
};

export default StatsCard;
