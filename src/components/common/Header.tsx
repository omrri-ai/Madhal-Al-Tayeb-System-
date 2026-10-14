import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Menu,
  ArrowRight,
  ArrowDownLeft,
  ArrowUpRight,
  Bell,
  Volume2,
  VolumeX,
  AlertTriangle,
  Boxes,
  CheckCircle2,
  X,
  Truck,
  Package,
  FileText,
  LogOut,
  ShieldCheck,
  Cloud,
  KeyRound,
  WifiOff,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';
import { NavView } from './Navigation';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { playNotificationSound } from '../../services/sound';

interface HeaderProps {
  currentView: NavView;
  onOpenMobileMenu: () => void;
  onOpenQuickMovement: (type?: 'IN' | 'OUT') => void;
  onOpenOutgoingDispatch?: () => void;
  onNavigateToItem?: (itemId: string) => void;
  onNavigate?: (view: NavView) => void;
  canGoBack?: boolean;
  onGoBack?: () => void;
  onOpenChangePassword?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onOpenMobileMenu,
  onOpenQuickMovement,
  onOpenOutgoingDispatch,
  onNavigateToItem,
  onNavigate,
  canGoBack,
  onGoBack,
  onOpenChangePassword,
}) => {
  const {
    items,
    units,
    categories,
    getItemStock,
    cloudSyncStatus,
    syncLocalToCloudNow,
    isOffline,
    hasUnsyncedOfflineData,
    unsyncedOfflineCount,
    recoverOrphanedLocalData,
  } = useInventory();
  const { user, logout, ownerEmail } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Low stock items analysis
  const lowStockItems = useMemo(() => {
    return items
      .filter((i) => !i.isDeleted && !i.isArchived)
      .map((item) => {
        const stock = getItemStock(item.id);
        const baseUnit = units.find((u) => u.id === item.baseUnitId);
        const category = categories.find((c) => c.id === item.categoryId);
        const isOut = stock <= 0;
        const isLow = item.minStockAlert > 0 && stock <= item.minStockAlert;
        return {
          item,
          categoryName: category?.name || 'عام',
          stock,
          baseUnitName: baseUnit?.name || 'وحدة',
          minStockAlert: item.minStockAlert,
          isOut,
          isLow,
        };
      })
      .filter((i) => i.isOut || i.isLow);
  }, [items, units, categories, getItemStock]);

  const hasLowStock = lowStockItems.length > 0;

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
    };
    if (notificationsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [notificationsOpen]);

  const handleToggleBell = () => {
    playNotificationSound('bell');
    setNotificationsOpen((prev) => !prev);
  };

  const titles: Record<NavView, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'لوحة التحكم والمؤشرات',
      subtitle: 'متابعة العمليات اليومية وإجمالي الأرصدة وحركة المخزون اللحظية',
    },
    items: {
      title: 'إدارة الأصناف والمخزون',
      subtitle: 'إضافة الأصناف، ضبط الوحدات والتحويلات، ومتابعة الأرصدة المتوفرة',
    },
    movements: {
      title: 'سجل حركات المخزون والصادر',
      subtitle: 'توثيق عمليات التوريد والصادر والشحنات للفروع والعملاء بدقة تامة',
    },
    production: {
      title: 'إدارة الإنتاج والتصنيع',
      subtitle: 'أوامر الإنتاج، صرف المواد الخام، تسجيل الاستهلاك، واستلام المنتجات الجاهزة',
    },
    branches: {
      title: 'إدارة الفروع والمستودعات',
      subtitle: 'إضافة وتعديل وحذف الفروع المعتمدة للتصدير وتوزيع المخزون',
    },
    customers: {
      title: 'إدارة العملاء',
      subtitle: 'سجل العملاء وجهات الصادر المعتمدة للفواتير والسندات الرسمية',
    },
    categories: {
      title: 'أقسام وتصنيفات الأصناف',
      subtitle: 'تنظيم المستودع وتصنيف المنتجات حسب الأقسام المخصصة',
    },
    units: {
      title: 'الوحدات العامة',
      subtitle: 'إدارة وحدات القياس (حبة، درزن، كرتون، شدة، كيلو...) لإعادة استخدامها',
    },
    archive: {
      title: 'الأرشيف وسلة المحذوفات',
      subtitle: 'استرجاع الأصناف ومطالعة أسباب وتاريخ الحذف والأرشفة بالتفصيل',
    },
    audit_log: {
      title: 'سجل التعديل والحذف',
      subtitle: 'سجل تدقيق ومراقبة دائم وموثق لجميع عمليات التعديل والحذف وأسبابها في النظام',
    },
    reports: {
      title: 'التقارير والإحصاءات',
      subtitle: 'تحليلات حركة المخزون، الأكثر طلباً، والأصناف الراكدة مع تنزيل PDF',
    },
    returns: {
      title: 'إدارة المرتجعات',
      subtitle: 'متابعة وتسجيل مرتجعات العملاء والموردين والفروع بدقة وتكامل تام مع الرصيد',
    },
    settings: {
      title: 'إدارة البيانات والنسخ الاحتياطي',
      subtitle: 'حفظ وتصدير واستيراد قاعدة بيانات المخزون الدائمة بأمان',
    },
  };

  const currentInfo = titles[currentView] || { title: 'نظام مدهال الطيب', subtitle: '' };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-3 sm:px-6 py-2.5 sm:py-3.5 no-print">
      <div className="flex items-center justify-between gap-2 sm:gap-4">
        {/* Left (RTL Start) Brand & Title & Mobile Burger & Back Button */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <button
            onClick={onOpenMobileMenu}
            className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
            aria-label="فتح القائمة الرئيسية"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* BACK BUTTON (Prominently displayed whenever navigating) */}
          {canGoBack && onGoBack && (
            <button
              onClick={onGoBack}
              className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer border border-slate-200 shadow-2xs hover:shadow-xs shrink-0"
              title="الرجوع إلى الشاشة السابقة"
            >
              <ArrowRight className="w-4 h-4 text-slate-700" />
              <span className="hidden sm:inline">رجوع</span>
            </button>
          )}

          {/* Clean Brand Header on Navbar */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-xl shadow-xs border border-emerald-500/30 shrink-0">
            <span className="text-emerald-400 text-xs sm:text-sm">👑</span>
            <span className="text-xs sm:text-sm font-black tracking-tight whitespace-nowrap text-white">
              مدهال الطيب
            </span>
          </div>

          <div className="h-5 w-px bg-slate-200 hidden md:block shrink-0" />

          <div className="min-w-0 truncate hidden sm:block">
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 leading-tight truncate">
              {currentInfo.title}
            </h2>
            <p className="hidden lg:block text-[11px] text-slate-500 mt-0.5 font-normal truncate">
              {currentInfo.subtitle}
            </p>
          </div>
        </div>

        {/* Right (RTL End) Header Actions: Bell Notification & Quick Access */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* INVOICES SECTION BUTTON */}
          {onNavigate && (
            <button
              onClick={() => onNavigate('movements')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                currentView === 'movements'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                  : 'bg-emerald-50/80 hover:bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
              title="الانتقال المباشر إلى قسم الفواتير وسجل الحركات"
            >
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">قسم الفواتير</span>
            </button>
          )}
          {/* NOTIFICATION BELL WITH VIBRATION & ELEGANT PULSING RED BADGE */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={handleToggleBell}
              className={`relative p-2 rounded-xl transition-all cursor-pointer border ${
                hasLowStock
                  ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100 shadow-xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="تنبيهات نقص المخزون والحد الأدنى"
              aria-label="التنبيهات"
            >
              <Bell
                className={`w-5 h-5 ${
                  hasLowStock ? 'animate-bell-shake text-rose-600' : 'text-slate-600'
                }`}
              />

              {/* Elegant Pulsing Red Badge */}
              {hasLowStock && (
                <>
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-600 text-white text-[10px] font-black font-mono items-center justify-center">
                      {lowStockItems.length > 9 ? '+9' : lowStockItems.length}
                    </span>
                  </span>
                </>
              )}
            </button>

            {/* Notifications Popover */}
            {notificationsOpen && (
              <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                {/* Popover Header */}
                <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center">
                      <Bell className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold">تنبيهات نقص المخزون والحد الأدنى</h4>
                      <span className="text-[10px] text-slate-400">
                        {hasLowStock
                          ? `${lowStockItems.length} أصناف تحتاج للتوريد العاجل`
                          : 'المخزون في حالة ممتازة'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => playNotificationSound('bell')}
                      className="p-1 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-white/10"
                      title="تجربة صوت الإشعار"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-white/10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Popover List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {lowStockItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500 space-y-2">
                      <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                      <p className="font-bold text-slate-800">لا توجد أي تنبيهات لنقص المخزون</p>
                      <p className="text-[11px] text-slate-400">
                        جميع الأصناف النشطة تتوفر بكميات تفوق الحد الأدنى للطلب.
                      </p>
                    </div>
                  ) : (
                    lowStockItems.map(({ item, categoryName, stock, baseUnitName, minStockAlert, isOut }) => (
                      <div
                        key={item.id}
                        className={`p-3 text-xs hover:bg-slate-50 transition-colors flex items-start justify-between gap-3 ${
                          isOut ? 'bg-rose-50/50' : 'bg-amber-50/30'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-slate-900">{item.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">({item.code})</span>
                          </div>

                          <div className="flex items-center gap-2 text-[11px]">
                            <span className="text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">
                              {categoryName}
                            </span>
                            <span
                              className={`font-bold ${
                                isOut ? 'text-rose-700' : 'text-amber-800'
                              }`}
                            >
                              {isOut
                                ? 'نفد بالكامل (0 متبقي)'
                                : `الرصيد: ${stock} من أصل ${minStockAlert} ${baseUnitName}`}
                            </span>
                          </div>
                        </div>

                        {/* Direct Supply Action */}
                        <button
                          onClick={() => {
                            setNotificationsOpen(false);
                            if (onNavigateToItem) {
                              onNavigateToItem(item.id);
                            } else {
                              onOpenQuickMovement('IN');
                            }
                          }}
                          className="shrink-0 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer shadow-2xs"
                        >
                          توريد (+)
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cloud Database Sync Status & Interactive Sync Button */}
          {isOffline ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-amber-300 bg-amber-50 text-[11px] font-bold text-amber-900 shadow-2xs"
              title="أنت حالياً بدون اتصال. جميع البيانات تُحفظ محلياً بأمان ولن تُفقد، وسيتم رفعها للسحابة فور عودة الإنترنت"
            >
              <WifiOff className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              <span className="text-[10px]">
                أوفلاين (محفوظ محلياً {hasUnsyncedOfflineData ? `· ${unsyncedOfflineCount} معلق` : ''})
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={async () => {
                playNotificationSound('bell');
                await syncLocalToCloudNow();
              }}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-[11px] font-bold text-slate-700 transition-all cursor-pointer shadow-2xs hover:shadow-xs"
              title="مزامنة وتثبيت بيانات المخزون في السحابة"
            >
              <Cloud
                className={`w-3.5 h-3.5 ${
                  cloudSyncStatus === 'synced'
                    ? 'text-emerald-600'
                    : cloudSyncStatus === 'syncing'
                    ? 'text-blue-500 animate-spin'
                    : 'text-amber-500'
                }`}
              />
              <span className="text-[10px]">
                {cloudSyncStatus === 'synced'
                  ? 'مزامنة السحابة'
                  : cloudSyncStatus === 'syncing'
                  ? 'جارٍ الحفظ...'
                  : 'مزامنة السحابة'}
              </span>
            </button>
          )}

          {/* Quick Offline Data Rescue Button */}
          <button
            type="button"
            onClick={async () => {
              playNotificationSound('bell');
              await recoverOrphanedLocalData();
            }}
            className="hidden lg:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100 text-[10px] font-bold text-purple-800 transition-all cursor-pointer shadow-2xs"
            title="فحص واسترجاع أي أصناف أو حركات فُقدت في المتصفح أثناء انقطاع الإنترنت"
          >
            <RefreshCw className="w-3 h-3 text-purple-600" />
            <span>استرجاع بيانات الأوفلاين</span>
          </button>

          {/* Change Password / Passcode Button */}
          {onOpenChangePassword && (
            <button
              onClick={() => {
                playNotificationSound('bell');
                onOpenChangePassword();
              }}
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs hover:shadow-xs"
              title="تغيير كلمة المرور الخاصة بالمالك"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              <span>تغيير كلمة المرور</span>
            </button>
          )}

          {/* Owner Account Badge & Logout Button */}
          <div className="flex items-center gap-1.5 bg-slate-900 text-white rounded-xl pl-1 pr-2.5 py-1 border border-slate-800 shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[10px] text-emerald-400 font-bold">المالك</span>
            </div>

            <button
              onClick={() => {
                playNotificationSound('bell');
                logout();
              }}
              className="p-1 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-lg transition-colors cursor-pointer mr-1"
              title="تسجيل الخروج الآمن"
              aria-label="تسجيل الخروج"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
