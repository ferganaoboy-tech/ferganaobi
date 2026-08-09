import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = "Tasdiqlash", 
  message = "Rostdan o'chirishni istaysizmi?", 
  confirmText = "O'chirish", 
  cancelText = "Bekor qilish",
  isDanger = true
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px] animate-fade-in">
      {/* Backdrop overlay click to close */}
      <div className="absolute inset-0" onClick={onClose} />
      
      <div className="relative bg-overlay border border-default rounded-lg w-[90%] max-w-[380px] flex flex-col animate-scale-up shadow-xl overflow-hidden">
        <div className="h-12 px-4 sm:px-5 border-b border-subtle flex items-center justify-between shrink-0 bg-surface">
          <span className="text-14 font-[600] text-primary flex items-center gap-2">
            {isDanger && <AlertTriangle className="w-4 h-4 text-state-danger-text" />}
            {title}
          </span>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-7 h-7 flex items-center justify-center text-secondary hover:text-primary hover:bg-subtle rounded transition-colors"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="p-5 bg-overlay">
          <p className="text-13 text-secondary leading-relaxed">{message}</p>
        </div>

        <div className="h-14 px-4 sm:px-5 border-t border-subtle flex items-center justify-end gap-2.5 shrink-0 bg-surface">
          <button 
            type="button" 
            onClick={onClose} 
            className="h-8 px-3.5 rounded text-12 font-[500] text-primary border border-default hover:bg-subtle active:scale-95 transition-all cursor-pointer"
          >
            {cancelText}
          </button>
          <button 
            type="button" 
            onClick={() => {
              onConfirm();
              onClose();
            }} 
            className={`h-8 px-3.5 rounded text-12 font-[500] text-inverse active:scale-[0.97] transition-all cursor-pointer ${
              isDanger 
                ? 'bg-state-danger-bg hover:opacity-90 border border-state-danger-border text-state-danger-text' 
                : 'bg-accent hover:bg-accent-hover'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;
