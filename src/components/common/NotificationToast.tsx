import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, X } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';

export const NotificationToast: React.FC = () => {
  const { toast, clearToast } = useInventory();

  if (!toast) return null;

  const bgConfig = {
    success: 'bg-emerald-900/90 text-emerald-50 border-emerald-700',
    error: 'bg-rose-900/90 text-rose-50 border-rose-700',
    info: 'bg-slate-900/90 text-slate-50 border-slate-700',
  }[toast.type];

  const Icon = {
    success: CheckCircle2,
    error: AlertCircle,
    info: AlertTriangle,
  }[toast.type];

  const iconColor = {
    success: 'text-emerald-400',
    error: 'text-rose-400',
    info: 'text-sky-400',
  }[toast.type];

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 max-w-md w-full px-4 animate-in fade-in slide-in-from-bottom-5 duration-200">
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md ${bgConfig}`}
      >
        <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${iconColor}`} />
        <p className="text-sm font-medium flex-1 leading-relaxed text-right">{toast.message}</p>
        <button
          onClick={clearToast}
          className="text-slate-400 hover:text-white transition-colors p-1 -mr-1"
          aria-label="إغلاق التنبيه"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
