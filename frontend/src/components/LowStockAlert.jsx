import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatQuantity } from '../utils/format';

const LowStockAlert = ({ items }) => {
  if (!items || items.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center h-full text-center">
        <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-white mb-1">Zaxira yetarli darajada</h3>
        <p className="text-gray-400 text-sm">Barcha mahsulotlar minimum miqdordan ko'p.</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-orange-500/30 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-gray-800 bg-orange-500/5 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-orange-500">Kam qolgan mahsulotlar</h3>
        <span className="ml-auto bg-orange-500/20 text-orange-400 py-0.5 px-2.5 rounded-full text-xs font-bold border border-orange-500/30">
          {items.length} ta
        </span>
      </div>
      
      <div className="overflow-y-auto flex-1 p-0">
        <table className="w-full text-left text-sm whitespace-nowrap">
          <thead className="bg-gray-950/50 text-gray-400 sticky top-0">
            <tr>
              <th className="px-4 py-3 font-medium">Mahsulot</th>
              <th className="px-4 py-3 font-medium">Artikul</th>
              <th className="px-4 py-3 font-medium">Sklad</th>
              <th className="px-4 py-3 font-medium text-right">Qoldiq / Min</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {items.map((item) => (
              <tr key={item._id} className="hover:bg-gray-800/30 transition-colors">
                <td className="px-4 py-3">
                  <span className="font-medium text-gray-200">{item.name}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-mono text-gray-400 bg-gray-800 px-2 py-1 rounded">{item.artikul}</span>
                </td>
                <td className="px-4 py-3 text-gray-400">
                  <div className="flex items-center gap-2">
                    <span 
                      className="w-2 h-2 rounded-full inline-block" 
                      style={{ backgroundColor: item.warehouse?.color || '#cbd5e1' }}
                    ></span>
                    {item.warehouse?.name}
                  </div>
                </td>
                <td className="px-4 py-3 text-right">
                  <span className="text-orange-400 font-bold">{formatQuantity(item.quantity, item.rollLength)}</span>
                  <span className="text-gray-500 mx-1">/</span>
                  <span className="text-gray-400">{item.minStock} rl</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LowStockAlert;
