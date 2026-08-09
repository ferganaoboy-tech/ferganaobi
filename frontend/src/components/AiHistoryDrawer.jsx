import React, { useEffect, useState } from 'react';
import { X, Clock, BrainCircuit, AlertCircle, ChevronRight } from 'lucide-react';
import api from '../api';

const AiHistoryDrawer = ({ isOpen, onClose, onSelectReport }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchHistory();
    }
  }, [isOpen]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/ai/history');
      if (response.data.success) {
        setHistory(response.data.data);
      } else {
        setError("Tarixni yuklashda xatolik");
      }
    } catch (err) {
      console.error(err);
      setError("Server bilan ulanishda xatolik");
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = async (id) => {
    try {
      const response = await api.get(`/ai/history/${id}`);
      if (response.data.success) {
        onSelectReport(response.data.data);
        onClose();
      }
    } catch (err) {
      console.error(err);
      alert("Tahlil ma'lumotlarini yuklashda xatolik yuz berdi.");
    }
  };

  const formatDate = (dateString) => {
    const d = new Date(dateString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${mins}`;
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300 ease-out ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div className={`fixed inset-y-0 right-0 z-50 w-full md:w-[400px] bg-surface border-l border-subtle shadow-2xl transform transition-transform duration-300 ease-out flex flex-col pb-safe ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}>
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 pb-6 pt-safe mt-4 border-b border-subtle shrink-0 bg-surface">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent/10 rounded-lg">
              <Clock className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-primary">Tahlillar Tarixi</h2>
              <p className="text-sm text-secondary">Saqlangan AI xulosalari</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-secondary hover:text-primary hover:bg-subtle rounded-xl transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 gap-3">
              <div className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin" />
              <p className="text-sm text-secondary animate-pulse">Tarix yuklanmoqda...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-40 gap-2 text-red-500">
              <AlertCircle className="w-8 h-8" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto bg-subtle rounded-full flex items-center justify-center mb-4">
                <BrainCircuit className="w-8 h-8 text-secondary/50" />
              </div>
              <p className="text-primary font-medium">Tarix bo'sh</p>
              <p className="text-sm text-secondary mt-1">Hozircha hech qanday tahlil saqlanmagan.</p>
            </div>
          ) : (
            history.map((item) => (
              <button
                key={item._id}
                onClick={() => handleSelect(item._id)}
                className="w-full text-left p-4 rounded-xl border border-subtle bg-app hover:border-accent/50 hover:shadow-sm transition-all group flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[13px] font-semibold text-primary">{formatDate(item.createdAt)}</span>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 bg-accent/10 text-accent rounded-full">
                      {item.modelUsed?.replace('gemini-', '') || 'AI'}
                    </span>
                  </div>
                  <p className="text-[13px] text-secondary">
                    Jami mahsulotlar: <span className="text-primary font-medium">{item.stats?.totalProducts || 0}</span>
                  </p>
                </div>
                <div className="text-secondary group-hover:text-accent transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
};

export default AiHistoryDrawer;
