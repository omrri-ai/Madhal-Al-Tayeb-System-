import React, { useState } from 'react';
import {
  Lock,
  Mail,
  KeyRound,
  LogIn,
  AlertTriangle,
  Boxes,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { playNotificationSound } from '../../services/sound';

export const LoginView: React.FC = () => {
  const {
    loginWithGoogle,
    loginWithEmail,
    loginAsVerifiedOwner,
    authError,
    clearError,
    ownerEmail,
  } = useAuth();
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordText, setShowPasswordText] = useState(false);

  // 1. Password / Passcode Login
  const handlePasswordLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!password || !password.trim()) return;

    playNotificationSound('bell');
    setIsSubmitting(true);
    try {
      await loginWithEmail(ownerEmail, password.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. One-click instant verified owner login
  const handleDirectOwnerLogin = async () => {
    playNotificationSound('bell');
    setIsSubmitting(true);
    try {
      await loginAsVerifiedOwner();
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Google OAuth Login
  const handleGoogleLogin = async () => {
    playNotificationSound('bell');
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25 mb-4">
            <Boxes className="w-7 h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            نظام مخزون مدهال الطيب
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            منظومة إدارة المخزون والفواتير وسلسلة الإمداد
          </p>

          <div className="inline-flex items-center gap-1.5 bg-emerald-950/80 border border-emerald-800/60 text-emerald-300 px-3 py-1 rounded-full text-[11px] font-bold mt-3">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>نظام محمي خاص بالمالك فقط</span>
          </div>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="mb-5 p-3.5 bg-rose-950/80 border border-rose-800/80 rounded-2xl flex items-start gap-2.5 text-xs text-rose-200 animate-in fade-in duration-200">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-bold block mb-0.5">تنبيه المصادقة:</span>
              <p className="leading-relaxed">{authError}</p>
            </div>
            <button
              onClick={clearError}
              className="text-rose-400 hover:text-white font-bold text-xs cursor-pointer p-0.5"
              aria-label="إغلاق التنبيه"
            >
              ✕
            </button>
          </div>
        )}

        {/* Authorized Owner Info Card */}
        <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5 mb-5 text-xs space-y-1.5">
          <div className="flex items-center justify-between text-slate-400 text-[11px]">
            <span>حساب المالك المصرح به:</span>
            <span className="text-emerald-400 font-bold flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> معتمد
            </span>
          </div>
          <div className="font-mono font-bold text-white bg-slate-950/80 px-3 py-2 rounded-xl border border-slate-800 flex items-center gap-2 text-[12px] dir-ltr text-left">
            <Mail className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{ownerEmail}</span>
          </div>
        </div>

        {/* Primary Password Login Form */}
        <form onSubmit={handlePasswordLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>كلمة المرور / الرمز السري:</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">
                مشفرة وخاصة بك
              </span>
            </label>
            <div className="relative">
              <input
                type={showPasswordText ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور الخاصة بحسابك..."
                required
                autoComplete="current-password"
                className="w-full px-3.5 py-3 pl-11 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-slate-500 outline-hidden transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPasswordText(!showPasswordText)}
                className="absolute left-3 top-3.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                title={showPasswordText ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                aria-label={showPasswordText ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
              >
                {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting || !password.trim()}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
          >
            <LogIn className="w-4 h-4 text-emerald-100" />
            <span>{isSubmitting ? 'جارٍ التحقق...' : 'تسجيل الدخول'}</span>
          </button>
        </form>

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase">
            <span className="bg-slate-900 px-3 text-slate-400 font-bold">
              أو خيارات الدخول السريع
            </span>
          </div>
        </div>

        {/* Secondary Login Options */}
        <div className="space-y-2.5">
          {/* Direct Instant Owner Login */}
          <button
            type="button"
            onClick={handleDirectOwnerLogin}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-slate-800/90 hover:bg-slate-700/90 border border-slate-700 text-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>دخول المالك المباشر (للأجهزة الموثوقة)</span>
          </button>

          {/* Google OAuth Login */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2.5 py-2 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl font-medium text-xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>الدخول عبر حساب Google</span>
          </button>
        </div>

        {/* Security Footer Notice */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500 leading-relaxed">
          <p>
            🔒 يمكنك تغيير كلمة المرور في أي وقت بعد الدخول للنظام من خلال زر (تغيير كلمة المرور) في شريط التحكم أو صفحة الإعدادات.
          </p>
        </div>
      </div>
    </div>
  );
};
