import React from 'react';
import { Plus, Sparkles } from 'lucide-react';

const ProductHeader = ({ totalProductsCount, openCreateModal, openAiParser }) => {
  return (
    <div className="flex items-center justify-between mb-[24px] shrink-0 gap-3">
      <div>
        <h1 className="text-[24px] sm:text-28 font-[600] tracking-[-0.03em] text-primary leading-tight">Mahsulotlar</h1>
        <p className="text-13 sm:text-14 text-secondary mt-1">Jami {totalProductsCount} ta mahsulot</p>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <button 
          onClick={openAiParser}
          className="w-10 h-10 sm:w-auto sm:h-9 sm:px-4 bg-indigo-50 text-indigo-600 rounded-full sm:rounded-md text-13 font-[500] hover:bg-indigo-100 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shrink-0 shadow-sm border border-indigo-200"
          title="AI orqali savatga qo'shish"
        >
          <Sparkles className="w-5 h-5 sm:w-4 sm:h-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">AI Parser</span>
        </button>
        <button 
          onClick={openCreateModal}
          className="w-10 h-10 sm:w-auto sm:h-9 sm:px-4 bg-accent text-inverse rounded-full sm:rounded-md text-13 font-[500] hover:bg-accent-hover active:scale-[0.98] transition-all flex items-center justify-center gap-2 shrink-0 shadow-sm"
          title="Yangi mahsulot qo'shish"
        >
          <Plus className="w-5 h-5 sm:w-4 sm:h-4" strokeWidth={1.5} />
          <span className="hidden sm:inline">Yangi qo'shish</span>
        </button>
      </div>
    </div>
  );
};

export default ProductHeader;
