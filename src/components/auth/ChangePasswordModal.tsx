import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertTriangle,
  X,
  ShieldCheck,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useInventory } from '../../context/InventoryContext';
import { playNotificationSound } from '../../services/sound';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { changeOwnerPasscode, resetOwnerPasscodeToDefault, ownerEmail } = useAuth();
  const { showToast } = useInventory();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (!isOpen) return null;

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setErrorMsg(null);
    setShowResetConfirm(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!currentPassword.trim()) {
      setErrorMsg('يرجى إدخال كلمة المرور الحالية.');
      return;
    }

    if (!newPassword.trim() || newPassword.trim().length < 4) {
      setErrorMsg('يجب ألا تقل كلمة المرور الجديدة عن 4 خانات.');
      return;
    }

    if (newPassword.trim() !== confirmPassword.trim()) {
      setErrorMsg('كلمة المرور الجديدة غير متطابقة مع تأكيد كلمة المرور.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await changeOwnerPasscode(currentPassword.trim(), newPassword.trim());
      if (result.success) {
        playNotificationSound('bell');
        showToast('تم تغيير كلمة المرور وحفظها سحابياً ومحلياً بنجاح 🔒', 'success');
        handleClose();
      } else {
        setErrorMsg(result.error || 'تعذر تغيير كلمة المرور.');
      }
    } catch (err: any) {
      setErrorMsg('حدث خطأ: ' + (err?.message || 'تعذر تغيير كلمة المرور'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetToDefault = async () => {
    setIsSubmitting(true);
    try {
      await resetOwnerPasscodeToDefault();
      playNotificationSound('bell');
      showToast('تمت استعادة كلمة المرور الافتراضية للنظام بنجاح', 'info');
      handleClose();
    } catch (err: any) {
      setErrorMsg('فشل الاستعادة: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isMatching = Boolean(newPassword && confirmPassword && newPassword === confirmPassword);
  const isMismatch = Boolean(newPassword && confirmPassword && newPassword !== confirmPassword);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/30">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">تغيير كلمة المرور الخاصة بالمالك</h3>
              <p className="text-[11px] text-slate-300 font-medium">حساب المالك: {ownerEmail}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed font-medium">{errorMsg}</div>
            </div>
          )}

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <p className="leading-relaxed text-[11px]">
              كلمة المرور الجديدة ستُحفظ بأمان في النظام وتُربط بحساب المالك للدخول بها من شاشة الدخول في أي وقت.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Current Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                كلمة المرور الحالية:
              </label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور الحالية..."
                  required
                  autoComplete="current-password"
                  className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-300 focus:border-emerald-500 rounded-xl text-xs text-slate-900 placeholder-slate-400 font-mono outline-hidden transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* New Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>كلمة المرور الجديدة:</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  (4 خانات على الأقل)
                </span>
              </label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="اختر كلمة مرور جديدة خاصة بك..."
                  required
                  autoComplete="new-password"
                  className="w-full px-3.5 py-2.5 pl-10 bg-slate-50 border border-slate-300 focus:border-emerald-500 rounded-xl text-xs text-slate-900 placeholder-slate-400 font-mono outline-hidden transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm New Password Field */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                <span>تأكيد كلمة المرور الجديدة:</span>
                {isMatching && (
                  <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> متطابقة
                  </span>
                )}
                {isMismatch && (
                  <span className="text-[10px] text-rose-600 font-bold">
                    غير متطابقة
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type={showConfirmPass ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="أعد كتابة كلمة المرور الجديدة..."
                  required
                  autoComplete="new-password"
                  className={`w-full px-3.5 py-2.5 pl-10 bg-slate-50 border rounded-xl text-xs text-slate-900 placeholder-slate-400 font-mono outline-hidden transition-colors ${
                    isMismatch
                      ? 'border-rose-400 focus:border-rose-500'
                      : isMatching
                      ? 'border-emerald-400 focus:border-emerald-500'
                      : 'border-slate-300 focus:border-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Buttons */}
            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword || isMismatch}
                className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'جارٍ الحفظ...' : 'حفظ كلمة المرور الجديدة'}</span>
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>

          {/* Reset to system default option */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            {!showResetConfirm ? (
              <button
                type="button"
                onClick={() => setShowResetConfirm(true)}
                className="text-[11px] text-slate-500 hover:text-slate-800 transition-colors font-medium flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3 text-slate-400" />
                <span>استعادة كلمة المرور الافتراضية للنظام</span>
              </button>
            ) : (
              <div className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-700 font-bold">
                  تأكيد استعادة الرمز الافتراضي؟
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    disabled={isSubmitting}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                  >
                    تأكيد
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowResetConfirm(false)}
                    className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-[10px] cursor-pointer"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
