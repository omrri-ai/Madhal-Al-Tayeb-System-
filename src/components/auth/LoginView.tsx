import React, { useState } from 'react';
import {
  Lock,
  Mail,
  LogIn,
  AlertTriangle,
  Boxes,
  ShieldCheck,
  Eye,
  EyeOff,
  Factory,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { playNotificationSound } from '../../services/sound';

export const LoginView: React.FC = () => {
  const {
    loginAsManager,
    loginAsFactorySupervisor,
    loginWithGoogle,
    authError,
    clearError,
    ownerEmail,
  } = useAuth();

  // Active tab: 'MANAGER' | 'FACTORY_SUPERVISOR'
  const [activeTab, setActiveTab] = useState<'MANAGER' | 'FACTORY_SUPERVISOR'>('MANAGER');

  // Manager state
  const [managerPassword, setManagerPassword] = useState('');
  const [showManagerPassword, setShowManagerPassword] = useState(false);
  const [managerFailCount, setManagerFailCount] = useState(0);

  // Factory Supervisor state
  const [supervisorPassword, setSupervisorPassword] = useState('');
  const [showSupervisorPassword, setShowSupervisorPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);

  // 1. Manager Login Handler
  const handleManagerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerPassword || !managerPassword.trim()) return;

    playNotificationSound('bell');
    setIsSubmitting(true);
    try {
      const res = await loginAsManager(managerPassword.trim());
      if (res.success) {
        setManagerPassword('');
        setManagerFailCount(0);
      } else {
        const nextCount = managerFailCount + 1;
        setManagerFailCount(nextCount);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 2. Factory Supervisor Login Handler
  const handleSupervisorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supervisorPassword || !supervisorPassword.trim()) return;

    playNotificationSound('bell');
    setIsSubmitting(true);
    try {
      const res = await loginAsFactorySupervisor(supervisorPassword.trim());
      if (res.success) {
        setSupervisorPassword('');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Google OAuth Login for Manager (Recovery)
  const handleGoogleLogin = async () => {
    playNotificationSound('bell');
    setIsSubmitting(true);
    try {
      await loginWithGoogle();
    } finally {
      setIsSubmitting(false);
      setShowGoogleModal(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 sm:p-6 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="absolute -top-32 -right-32 w-96 h-96 bg-emerald-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-teal-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* SINGLE CENTRAL CARD */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 sm:p-8 relative z-10 space-y-6">
        
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/25 mb-3">
            <Boxes className="w-7 h-7" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            نظام مخزون مدهال الطيب
          </h1>
          <p className="text-xs text-slate-400 mt-1 font-medium">
            منظومة إدارة المخزون والمصنع وسلسلة الإمداد
          </p>
        </div>

        {/* TWO TABS AT THE TOP */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950 rounded-2xl border border-slate-800">
          <button
            type="button"
            onClick={() => {
              clearError();
              setActiveTab('MANAGER');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'MANAGER'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>وضع المدير</span>
          </button>

          <button
            type="button"
            onClick={() => {
              clearError();
              setActiveTab('FACTORY_SUPERVISOR');
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'FACTORY_SUPERVISOR'
                ? 'bg-teal-600 text-white shadow-md shadow-teal-600/25'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Factory className="w-4 h-4" />
            <span>مسؤول المصنع</span>
          </button>
        </div>

        {/* Auth Error Banner */}
        {authError && (
          <div className="p-3.5 bg-rose-950/80 border border-rose-800/80 rounded-2xl flex items-start gap-2.5 text-xs text-rose-200 animate-in fade-in duration-200">
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

        {/* TAB 1: MANAGER */}
        {activeTab === 'MANAGER' && (
          <form onSubmit={handleManagerSubmit} className="space-y-4">
            <div className="bg-emerald-950/40 border border-emerald-800/40 rounded-2xl p-3 text-xs text-emerald-200">
              <div className="flex items-center gap-1.5 font-bold mb-1 text-emerald-400">
                <UserCheck className="w-4 h-4" />
                <span>دخول المدير (صلاحيات كاملة)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                أدخل كلمة المرور الخاصة بك للتحكم الكامل في الأصناف والمخزون والإعدادات.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                كلمة مرور المدير:
              </label>
              <div className="relative">
                <input
                  type={showManagerPassword ? 'text' : 'password'}
                  value={managerPassword}
                  onChange={(e) => setManagerPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور..."
                  required
                  autoComplete="current-password"
                  autoFocus
                  className="w-full px-3.5 py-3 pl-11 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl text-sm text-white placeholder-slate-500 outline-hidden transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowManagerPassword(!showManagerPassword)}
                  className="absolute left-3 top-3.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  title={showManagerPassword ? 'إخفاء' : 'إظهار'}
                >
                  {showManagerPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !managerPassword.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <LogIn className="w-4 h-4 text-emerald-100" />
              <span>دخول وضع المدير (بكلمة المرور)</span>
            </button>

            <div className="relative my-3">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-800" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-slate-900 text-slate-500 font-medium">أو عبر حساب المالك السحابي الموثق</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-slate-950 hover:bg-slate-800/80 border border-slate-700 hover:border-emerald-500/50 text-slate-200 hover:text-white rounded-xl font-bold text-xs transition-all cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>دخول المدير المعتمد عبر Google</span>
            </button>

            {/* "Forgot password" link appears automatically if needed */}
            {managerFailCount > 3 && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(true)}
                  className="text-xs text-emerald-400 hover:text-emerald-300 underline transition-colors cursor-pointer"
                >
                  هل نسيت كلمة المرور؟ (استعادة عبر Google)
                </button>
              </div>
            )}
          </form>
        )}

        {/* TAB 2: FACTORY SUPERVISOR */}
        {activeTab === 'FACTORY_SUPERVISOR' && (
          <form onSubmit={handleSupervisorSubmit} className="space-y-4">
            <div className="bg-teal-950/40 border border-teal-800/40 rounded-2xl p-3 text-xs text-teal-200">
              <div className="flex items-center gap-1.5 font-bold mb-1 text-teal-400">
                <Factory className="w-4 h-4" />
                <span>دخول مسؤول المصنع (مشاهدة فقط)</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                أدخل كلمة المرور المعتمدة (12345678) للدخول بوضع المشاهدة وقراءة التقارير والأرصدة بدون تعديل.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">
                كلمة مرور مسؤول المصنع:
              </label>
              <div className="relative">
                <input
                  type={showSupervisorPassword ? 'text' : 'password'}
                  value={supervisorPassword}
                  onChange={(e) => setSupervisorPassword(e.target.value)}
                  placeholder="أدخل كلمة المرور (12345678)..."
                  required
                  autoComplete="current-password"
                  autoFocus
                  className="w-full px-3.5 py-3 pl-11 bg-slate-950 border border-slate-700 focus:border-teal-500 rounded-xl text-sm text-white placeholder-slate-500 outline-hidden transition-all font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowSupervisorPassword(!showSupervisorPassword)}
                  className="absolute left-3 top-3.5 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                  title={showSupervisorPassword ? 'إخفاء' : 'إظهار'}
                >
                  {showSupervisorPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || !supervisorPassword.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-bold text-sm shadow-lg shadow-teal-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <UserCheck className="w-4 h-4 text-teal-100" />
              <span>دخول مسؤول المصنع</span>
            </button>
          </form>
        )}

        {/* Google Recovery Modal */}
        {showGoogleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-4 animate-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto">
                <Mail className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-white">استعادة صلاحيات المدير</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                يمكنك استعادة الدخول السريع والآمن عبر حساب Google المعتمد للمالك:
              </p>
              <div className="p-2.5 bg-slate-950 rounded-xl text-xs font-mono text-emerald-300 border border-slate-800">
                {ownerEmail}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>تسجيل الدخول عبر Google</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowGoogleModal(false)}
                  className="py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Security Footer Notice */}
        <div className="pt-3 border-t border-slate-800 text-center text-[10px] text-slate-500 leading-relaxed">
          <p>
            🔒 نظام مخزون مدهال الطيب محمي بصلاحيات أدوار صارمة تمنع التعديلات غير المصرح بها على الأرصدة والمخزون.
          </p>
        </div>
      </div>
    </div>
  );
};
