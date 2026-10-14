/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { InventoryProvider, useInventory } from './context/InventoryContext';
import { Navigation, NavView } from './components/common/Navigation';
import { Header } from './components/common/Header';
import { NotificationToast } from './components/common/NotificationToast';
import { ConfirmDialog } from './components/common/ConfirmDialog';

import { DashboardView } from './components/dashboard/DashboardView';
import { ItemsView } from './components/items/ItemsView';
import { ItemFormModal } from './components/items/ItemFormModal';
import { StockMovementModal } from './components/movements/StockMovementModal';
import { OutgoingDispatchModal } from './components/movements/OutgoingDispatchModal';
import { MovementsView } from './components/movements/MovementsView';
import { ReturnsView } from './components/returns/ReturnsView';
import { CategoriesView } from './components/categories/CategoriesView';
import { UnitsView } from './components/units/UnitsView';
import { BranchesView } from './components/branches/BranchesView';
import { CustomersView } from './components/customers/CustomersView';
import { ArchiveTrashView } from './components/archive/ArchiveTrashView';
import { ProductionView } from './components/production/ProductionView';
import { AuditLogView } from './components/audit/AuditLogView';
import { ReportsView, ReportsFilterState } from './components/reports/ReportsView';
import { BackupSettingsView } from './components/settings/BackupSettingsView';
import { LoginView } from './components/auth/LoginView';
import { ChangePasswordModal } from './components/auth/ChangePasswordModal';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Item, MovementType } from './types/inventory';
import { Boxes } from 'lucide-react';

const InventoryApp: React.FC = () => {
  const { isOwner, isLoading: isAuthLoading } = useAuth();
  const { archiveItem, softDeleteItem, isLoading: isDataLoading } = useInventory();

  // Navigation with history tracking
  const [currentView, setCurrentView] = useState<NavView>('dashboard');
  const [viewHistory, setViewHistory] = useState<NavView[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Reports filters retention and interactive navigation state
  const [reportsSavedFilters, setReportsSavedFilters] = useState<ReportsFilterState>({
    period: 'this_month',
    branchId: 'all',
    categoryId: 'all',
    selectedMovementType: 'all',
    searchQuery: '',
  });
  const [navParams, setNavParams] = useState<Record<string, any>>({});
  const [cameFromReports, setCameFromReports] = useState(false);

  // Modals state
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [movementModalType, setMovementModalType] = useState<MovementType>('IN');
  const [preselectedMovementItemId, setPreselectedMovementItemId] = useState<string>('');

  // Outgoing Multi-Item Dispatch Modal state
  const [isOutgoingDispatchOpen, setIsOutgoingDispatchOpen] = useState(false);

  // Change Password Modal state
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

  // Item deletion/archive confirmation state
  const [itemConfirmState, setItemConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: (reason?: string) => void;
    isDestructive: boolean;
    requiresReason?: boolean;
    reasonLabel?: string;
    reasonPlaceholder?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
    isDestructive: false,
  });

  // Handlers
  const navigateToView = (nextView: NavView) => {
    if (nextView !== currentView) {
      setViewHistory((prev) => [...prev, currentView]);
      setCurrentView(nextView);
    }
  };

  const handleNavigateFromReports = (nextView: NavView, params?: Record<string, any>) => {
    setNavParams(params || {});
    setCameFromReports(true);
    navigateToView(nextView);
  };

  const handleReturnToReports = () => {
    setCameFromReports(false);
    setNavParams({});
    setCurrentView('reports');
  };

  const handleGoBack = () => {
    if (cameFromReports) {
      handleReturnToReports();
      return;
    }
    if (viewHistory.length > 0) {
      const prev = viewHistory[viewHistory.length - 1];
      setViewHistory((old) => old.slice(0, old.length - 1));
      setCurrentView(prev);
    } else {
      setCurrentView('dashboard');
    }
  };

  const handleOpenAddItem = () => {
    setEditingItem(null);
    setIsItemModalOpen(true);
  };

  const handleEditItem = (item: Item) => {
    setEditingItem(item);
    setIsItemModalOpen(true);
  };

  const handleOpenMovementModal = (item?: Item, type: MovementType = 'IN') => {
    setMovementModalType(type);
    setPreselectedMovementItemId(item ? item.id : '');
    setIsMovementModalOpen(true);
  };

  const handleRequestArchiveItem = (item: Item) => {
    setItemConfirmState({
      isOpen: true,
      title: 'أرشفة الصنف',
      message: `هل أنت متأكد من رغبتك في أرشفة الصنف "${item.name}"؟ سيبقى رصيده وسجل حركاته محفوظاً في شاشة الأرشيف.`,
      isDestructive: false,
      requiresReason: true,
      reasonLabel: 'سبب الأرشفة',
      reasonPlaceholder: 'اكتب سبب أرشفة هذا الصنف هنا (إلزامي)...',
      action: (reason) => {
        if (!reason?.trim()) return;
        archiveItem(item.id, reason.trim());
      },
    });
  };

  const handleRequestDeleteItem = (item: Item) => {
    setItemConfirmState({
      isOpen: true,
      title: 'نقل الصنف إلى سلة المحذوفات',
      message: `هل تريد نقل الصنف "${item.name}" إلى سلة المحذوفات؟ يمكنك استعادته في أي وقت من شاشة المحذوفات.`,
      isDestructive: true,
      requiresReason: true,
      reasonLabel: 'سبب الحذف',
      reasonPlaceholder: 'اكتب سبب حذف هذا الصنف هنا (إلزامي)...',
      action: (reason) => {
        if (!reason?.trim()) return;
        softDeleteItem(item.id, reason.trim());
      },
    });
  };

  // Authentication & Security Guard: Block unauthorized guests immediately
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-white font-sans selection:bg-emerald-500 selection:text-white">
        <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center animate-pulse mb-3 shadow-lg shadow-emerald-500/25">
          <Boxes className="w-6 h-6 text-white" />
        </div>
        <h3 className="text-base font-black">نظام مخزون مدهال الطيب</h3>
        <p className="text-xs text-slate-400 mt-1">جارٍ التحقق من صلاحيات الأمان والاتصال السحابي...</p>
      </div>
    );
  }

  if (!isOwner) {
    return <LoginView />;
  }

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-800 font-sans selection:bg-emerald-500 selection:text-white pb-16 lg:pb-0">
      {/* Sidebar Navigation (Desktop & Mobile Drawer & Bottom Bar) */}
      <Navigation
        currentView={currentView}
        onSelectView={navigateToView}
        onOpenQuickMovement={(type) => handleOpenMovementModal(undefined, type || 'IN')}
        mobileMenuOpen={mobileMenuOpen}
        setMobileMenuOpen={setMobileMenuOpen}
        onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header with Back button */}
        <Header
          currentView={currentView}
          canGoBack={currentView !== 'dashboard' || viewHistory.length > 0}
          onGoBack={handleGoBack}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onOpenQuickMovement={(type) => handleOpenMovementModal(undefined, type || 'IN')}
          onOpenOutgoingDispatch={() => setIsOutgoingDispatchOpen(true)}
          onNavigateToItem={() => navigateToView('items')}
          onNavigate={navigateToView}
          onOpenChangePassword={() => setIsChangePasswordModalOpen(true)}
        />

        {/* View Container */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              onNavigate={navigateToView}
              onOpenQuickMovement={(type) => handleOpenMovementModal(undefined, type || 'IN')}
              onOpenOutgoingDispatch={() => setIsOutgoingDispatchOpen(true)}
              onOpenAddItem={handleOpenAddItem}
            />
          )}

          {currentView === 'items' && (
            <ItemsView
              onOpenAddItem={handleOpenAddItem}
              onEditItem={handleEditItem}
              onOpenMovementModal={(item, type) => handleOpenMovementModal(item, type)}
              onRequestArchive={handleRequestArchiveItem}
              onRequestDelete={handleRequestDeleteItem}
              initialViewMode={navParams.viewMode}
              initialCategoryId={navParams.categoryId}
              initialStatusFilter={navParams.statusFilter}
              initialZeroStockOnly={navParams.zeroStockOnly}
              initialSearchQuery={navParams.searchQuery}
              initialDetailItemId={navParams.detailItemId}
              returnToReports={cameFromReports ? handleReturnToReports : undefined}
            />
          )}

          {currentView === 'movements' && (
            <MovementsView
              onOpenNewMovement={(type) => handleOpenMovementModal(undefined, type || 'IN')}
              onOpenOutgoingDispatch={() => setIsOutgoingDispatchOpen(true)}
              initialType={navParams.typeFilter}
              initialBranchId={navParams.branchId}
              initialStartDate={navParams.startDate}
              initialEndDate={navParams.endDate}
              initialSearchQuery={navParams.searchQuery}
              initialMovementId={navParams.movementId}
              returnToReports={cameFromReports ? handleReturnToReports : undefined}
            />
          )}

          {currentView === 'production' && (
            <ProductionView onOpenAddItem={handleOpenAddItem} />
          )}

          {currentView === 'returns' && <ReturnsView />}

          {currentView === 'categories' && <CategoriesView />}

          {currentView === 'units' && <UnitsView />}

          {currentView === 'branches' && <BranchesView />}

          {currentView === 'customers' && <CustomersView />}

          {currentView === 'archive' && <ArchiveTrashView />}

          {currentView === 'audit_log' && <AuditLogView />}

          {currentView === 'reports' && (
            <ReportsView
              onNavigateToView={handleNavigateFromReports}
              savedFilters={reportsSavedFilters}
              onSaveFilters={setReportsSavedFilters}
            />
          )}

          {currentView === 'settings' && <BackupSettingsView />}
        </main>
      </div>

      {/* Global Modals */}
      {/* 1. Item Form Modal */}
      <ItemFormModal
        isOpen={isItemModalOpen}
        onClose={() => setIsItemModalOpen(false)}
        editingItem={editingItem}
      />

      {/* 2. Stock Movement Modal */}
      <StockMovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        defaultType={movementModalType}
        preselectedItemId={preselectedMovementItemId}
      />

      {/* 3. Outgoing Multi-Item Dispatch Modal (الشحنات وتصدير الفروع والعملاء) */}
      <OutgoingDispatchModal
        isOpen={isOutgoingDispatchOpen}
        onClose={() => setIsOutgoingDispatchOpen(false)}
      />

      {/* 4. Change Password Modal (تغيير كلمة المرور الخاصة بالمالك) */}
      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />

      {/* 5. Item Confirm Dialog */}
      <ConfirmDialog
        isOpen={itemConfirmState.isOpen}
        title={itemConfirmState.title}
        message={itemConfirmState.message}
        isDestructive={itemConfirmState.isDestructive}
        confirmLabel={itemConfirmState.isDestructive ? 'تأكيد الحذف والنقل للمحذوفات' : 'تأكيد الأرشفة'}
        requiresReason={itemConfirmState.requiresReason}
        reasonLabel={itemConfirmState.reasonLabel}
        reasonPlaceholder={itemConfirmState.reasonPlaceholder}
        onConfirm={(reason) => {
          itemConfirmState.action(reason);
          setItemConfirmState((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setItemConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* 6. Global Toast Notifications */}
      <NotificationToast />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <InventoryProvider>
        <InventoryApp />
      </InventoryProvider>
    </AuthProvider>
  );
}
