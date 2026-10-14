import React from 'react';
import {
  LayoutDashboard,
  Boxes,
  ArrowLeftRight,
  RotateCcw,
  FolderTree,
  Scale,
  Archive,
  BarChart3,
  Database,
  PlusCircle,
  Menu,
  X,
  Building2,
  Users,
  KeyRound,
  Settings,
  History,
  Factory,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';

export type NavView =
  | 'dashboard'
  | 'items'
  | 'movements'
  | 'production'
  | 'returns'
  | 'branches'
  | 'customers'
  | 'categories'
  | 'units'
  | 'archive'
  | 'audit_log'
  | 'reports'
  | 'settings';

interface NavigationProps {
  currentView: NavView;
  onSelectView: (view: NavView) => void;
  onOpenQuickMovement: (type?: 'IN' | 'OUT') => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  onOpenChangePassword?: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentView,
  onSelectView,
  onOpenQuickMovement,
  mobileMenuOpen,
  setMobileMenuOpen,
  onOpenChangePassword,
}) => {
  const { stats, customers } = useInventory();

  const navItems = [
    {
      id: 'dashboard' as NavView,
      label: 'الرئيسية',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      id: 'items' as NavView,
      label: 'الأصناف والمخزون',
      icon: Boxes,
      badge: stats.activeItemsCount > 0 ? stats.activeItemsCount : null,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'movements' as NavView,
      label: 'سجل الحركات',
      icon: ArrowLeftRight,
      badge: stats.todayInMovementsCount + stats.todayOutMovementsCount > 0 ? `${stats.todayInMovementsCount + stats.todayOutMovementsCount} اليوم` : null,
      badgeColor: 'bg-blue-100 text-blue-800',
    },
    {
      id: 'production' as NavView,
      label: 'الإنتاج والتصنيع',
      icon: Factory,
      badge: stats.openProductionOrdersCount + stats.pendingReceiptProductionOrdersCount > 0
        ? `${stats.openProductionOrdersCount + stats.pendingReceiptProductionOrdersCount}`
        : null,
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    {
      id: 'returns' as NavView,
      label: 'المرتجعات',
      icon: RotateCcw,
      badge: stats.totalReturnsCount > 0 ? stats.totalReturnsCount : null,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'branches' as NavView,
      label: 'إدارة الفروع',
      icon: Building2,
      badge: null,
    },
    {
      id: 'customers' as NavView,
      label: 'إدارة العملاء',
      icon: Users,
      badge: customers.length > 0 ? customers.length : null,
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    {
      id: 'categories' as NavView,
      label: 'الأقسام',
      icon: FolderTree,
      badge: stats.categoriesCount > 0 ? stats.categoriesCount : null,
      badgeColor: 'bg-slate-100 text-slate-700',
    },
    {
      id: 'units' as NavView,
      label: 'الوحدات العامة',
      icon: Scale,
      badge: null,
    },
    {
      id: 'archive' as NavView,
      label: 'الأرشيف والمحذوفات',
      icon: Archive,
      badge: stats.archivedItemsCount + stats.deletedItemsCount > 0 ? stats.archivedItemsCount + stats.deletedItemsCount : null,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'audit_log' as NavView,
      label: 'سجل التعديل والحذف',
      icon: History,
      badge: null,
    },
    {
      id: 'reports' as NavView,
      label: 'التقارير والتحليلات',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'settings' as NavView,
      label: 'الإعدادات والبيانات',
      icon: Settings,
      badge: null,
    },
  ];

  return (
    <>
      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 bg-white border-l border-slate-200 min-h-screen shrink-0 select-none">
        {/* App Brand Header */}
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20">
              <Boxes className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-base font-black text-slate-900 tracking-tight leading-tight">نظام مخزون مدهال الطيب</h1>
              <p className="text-xs text-slate-500 font-medium">إدارة المخزون والفواتير</p>
            </div>
          </div>

          {/* Quick Actions in Sidebar */}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              onClick={() => onOpenQuickMovement('IN')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-emerald-200/60"
            >
              <span className="text-sm font-bold">+</span>
              وارد جديد
            </button>
            <button
              onClick={() => onOpenQuickMovement('OUT')}
              className="flex items-center justify-center gap-1.5 py-2 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-colors cursor-pointer border border-rose-200/60"
            >
              <span className="text-sm font-bold">-</span>
              قسم صادر
            </button>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge !== null && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                      isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Change Password Button in Desktop Sidebar Footer */}
        {onOpenChangePassword && (
          <div className="p-3.5 border-t border-slate-100 bg-slate-50/70">
            <button
              onClick={onOpenChangePassword}
              className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 hover:border-emerald-200 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
              <span>تغيير كلمة مرور المالك</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile & Tablet Drawer Modal */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[80vw] bg-white h-full flex flex-col z-10 shadow-2xl animate-in slide-in-from-right duration-200">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Boxes className="w-5 h-5" />
                </div>
                <span className="font-black text-slate-900 text-sm">نظام مخزون مدهال الطيب</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                aria-label="إغلاق القائمة"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectView(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl font-medium text-sm transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-slate-900 text-white font-semibold'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-400' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== null && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-mono font-medium ${
                          isActive ? 'bg-white/20 text-white' : item.badgeColor || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Change Password in Mobile Drawer Footer */}
            {onOpenChangePassword && (
              <div className="p-3 border-t border-slate-100 bg-slate-50">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenChangePassword();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  <KeyRound className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تغيير كلمة المرور</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar (Very convenient for smartphone use!) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
        <button
          onClick={() => onSelectView('dashboard')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[11px] font-medium transition-colors ${
            currentView === 'dashboard' ? 'text-emerald-600 font-bold' : 'text-slate-500'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span>الرئيسية</span>
        </button>

        <button
          onClick={() => onSelectView('items')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[11px] font-medium transition-colors ${
            currentView === 'items' ? 'text-emerald-600 font-bold' : 'text-slate-500'
          }`}
        >
          <Boxes className="w-5 h-5" />
          <span>الأصناف</span>
        </button>

        {/* Center Action Button for Mobile */}
        <button
          onClick={() => onOpenQuickMovement()}
          className="flex flex-col items-center justify-center -mt-5 w-12 h-12 rounded-full bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700 transition-transform active:scale-95 cursor-pointer"
          title="تسجيل حركة مخزنية"
        >
          <ArrowLeftRight className="w-5 h-5" />
        </button>

        <button
          onClick={() => onSelectView('movements')}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[11px] font-medium transition-colors ${
            currentView === 'movements' ? 'text-emerald-600 font-bold' : 'text-slate-500'
          }`}
        >
          <ArrowLeftRight className="w-5 h-5" />
          <span>الحركات</span>
        </button>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center gap-0.5 py-1 px-2 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
        >
          <Menu className="w-5 h-5" />
          <span>المزيد</span>
        </button>
      </div>
    </>
  );
};
