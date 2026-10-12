import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  requiresReason?: boolean;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'تأكيد',
  cancelLabel = 'إلغاء',
  isDestructive = true,
  requiresReason = false,
  reasonLabel = 'سبب الإجراء',
  reasonPlaceholder = 'اكتب السبب هنا...',
  onConfirm,
  onCancel,
}) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (isOpen) {
      setReason('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const isConfirmDisabled = requiresReason && !reason.trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 overflow-hidden text-right">
        <button
          onClick={onCancel}
          className="absolute top-4 left-4 p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          aria-label="إغلاق"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
              isDestructive ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
            }`}
          >
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          </div>
        </div>

        <p className="text-slate-600 text-sm leading-relaxed mb-4">{message}</p>

        {requiresReason && (
          <div className="mb-5 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              {reasonLabel} <span className="text-rose-500">* (مطلوب)</span>
            </label>
            <textarea
              rows={2}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={reasonPlaceholder}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            {!reason.trim() ? (
              <p className="text-[11px] text-rose-500 font-medium mt-1">
                * لا يمكن المتابعة دون كتابة السبب.
              </p>
            ) : null}
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-medium text-sm transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isConfirmDisabled}
            onClick={() => onConfirm(reason.trim())}
            className={`px-5 py-2.5 rounded-xl text-white font-medium text-sm transition-colors shadow-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700 focus:ring-4 focus:ring-rose-200'
                : 'bg-emerald-600 hover:bg-emerald-700 focus:ring-4 focus:ring-emerald-200'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
