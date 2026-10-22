import React, { useState, useMemo } from 'react';
import { Archive, Trash2, RotateCcw, AlertTriangle, ShieldCheck, Boxes, X, Eye, Info } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { Item } from '../../types/inventory';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { ItemArchiveDetailModal } from './ItemArchiveDetailModal';

export const ArchiveTrashView: React.FC = () => {
  const {
    items,
    categories,
    units,
    getItemStock,
    restoreItem,
    softDeleteItem,
    restoreFromTrash,
    permanentDeleteItem,
  } = useInventory();
  const { isAdmin } = useAuth();

  const [activeTab, setActiveTab] = useState<'archive' | 'trash'>('archive');

  // Item Detail Modal state (to see full data and why it was archived/deleted)
  const [selectedDetailItem, setSelectedDetailItem] = useState<Item | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const handleOpenItemDetails = (item: Item) => {
    setSelectedDetailItem(item);
    setIsDetailModalOpen(true);
  };

  // Confirmation dialog state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    action: (reason?: string) => void;
    isDestructive: boolean;
    requiresReason?: boolean;
    reasonLabel?: string;
    reasonPlaceholder?: string;
    confirmLabel?: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: () => {},
    isDestructive: false,
  });

  const archivedItems = useMemo(() => {
    return items.filter((i) => i.isArchived && !i.isDeleted);
  }, [items]);

  const deletedItems = useMemo(() => {
    return items.filter((i) => i.isDeleted);
  }, [items]);

  const handleRestoreFromArchive = (item: Item) => {
    setConfirmState({
      isOpen: true,
      title: 'استعادة الصنف من الأرشيف',
      message: `هل تريد إعادة الصنف "${item.name}" إلى قائمة الأصناف النشطة في المستودع؟`,
      confirmLabel: 'تأكيد الاستعادة',
      action: () => restoreItem(item.id),
      isDestructive: false,
      requiresReason: false,
    });
  };

  const handleMoveArchiveToTrash = (item: Item) => {
    setConfirmState({
      isOpen: true,
      title: 'نقل إلى سلة المحذوفات',
      message: `هل تريد نقل الصنف المؤرشف "${item.name}" إلى سلة المحذوفات؟`,
      confirmLabel: 'تأكيد النقل للمحذوفات',
      requiresReason: true,
      reasonLabel: 'سبب الحذف والنقل للمحذوفات',
      reasonPlaceholder: 'اكتب سبب حذف هذا الصنف (إلزامي)...',
      action: (reason) => {
        if (!reason?.trim()) return;
        softDeleteItem(item.id, reason.trim());
      },
      isDestructive: true,
    });
  };

  const handleRestoreFromTrash = (item: Item) => {
    setConfirmState({
      isOpen: true,
      title: 'استعادة الصنف المحذوف',
      message: `هل تريد استعادة الصنف "${item.name}" بالكامل مع الاحتفاظ بجميع أرصدته وحركاته السابقة؟`,
      confirmLabel: 'تأكيد الاستعادة',
      action: () => restoreFromTrash(item.id),
      isDestructive: false,
      requiresReason: false,
    });
  };

  const handlePermanentDelete = (item: Item) => {
    setConfirmState({
      isOpen: true,
      title: 'الحذف النهائي الشامل للصنف',
      message: `تحذير: الحذف النهائي للصنف "${item.name}" سيزيله نهائياً من المستودع ومن سجل الحركات وسلة المحذوفات بحيث لا يظهر بأي تقرير أو حركة بعد الآن.`,
      confirmLabel: 'تأكيد الحذف النهائي الشامل',
      requiresReason: true,
      reasonLabel: 'سبب الحذف النهائي',
      reasonPlaceholder: 'اكتب سبب الحذف النهائي لهذا الصنف (إلزامي)...',
      action: (reason) => {
        if (!reason?.trim()) return;
        permanentDeleteItem(item.id, reason.trim());
      },
      isDestructive: true,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Info */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">الأرشيف وسلة المحذوفات</h3>
          <p className="text-xs text-slate-500 mt-1">
            إدارة الأصناف غير النشطة أو المحذوفة مع ضمان حماية سجلات الحركات التاريخية وسهولة الاستعادة
          </p>
        </div>

        {/* Tabs toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('archive')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'archive'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Archive className="w-4 h-4 text-amber-600" />
            <span>الأصناف المؤرشفة ({archivedItems.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('trash')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'trash'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>سلة المحذوفات ({deletedItems.length})</span>
          </button>
        </div>
      </div>

      {/* Safety Notice Banner & Click Hint */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>حماية السجلات:</strong> نقل الصنف للأرشيف أو المحذوفات لا يحذف حركاته التاريخية لضمان سلامة الجرد.
          </p>
        </div>
        <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            <strong>عرض البيانات والسبب:</strong> انقر مباشرة على أي صنف في الجدول لعرض بطاقته الكاملة وسبب وتاريخ الإجراء بالتفصيل.
          </p>
        </div>
      </div>

      {/* Tab 1: Archived Items */}
      {activeTab === 'archive' && (
        <div>
          {archivedItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
                <Archive className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">لا توجد أصناف مؤرشفة</h3>
              <p className="text-xs text-slate-500">
                عند أرشفة أي صنف موسمي أو متوقف، سيظهر هنا مع إمكانية استعادته في أي وقت.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-4">الصنف والرمز (انقر للتفاصيل)</th>
                    <th className="py-3.5 px-4">القسم</th>
                    <th className="py-3.5 px-4">الوحدة الأساسية</th>
                    <th className="py-3.5 px-4">الرصيد المحفوظ</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {archivedItems.map((item) => {
                    const cat = categories.find((c) => c.id === item.categoryId);
                    const unit = units.find((u) => u.id === item.baseUnitId);
                    const stock = getItemStock(item.id);

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-amber-50/40 transition-colors cursor-pointer group"
                        onClick={() => handleOpenItemDetails(item)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 group-hover:text-amber-800 transition-colors block">
                              {item.name}
                            </span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-bold">
                              عرض التفاصيل والسبب
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">{item.code}</span>
                          {item.archiveReason && (
                            <span className="block text-[11px] text-amber-800 bg-amber-50 border border-amber-200/60 px-2 py-0.5 rounded-md mt-1 font-medium w-fit">
                              سبب الأرشفة: {item.archiveReason}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600">{cat?.name || '-'}</td>
                        <td className="py-3.5 px-4 text-xs font-bold text-slate-700">{unit?.name || '-'}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {stock} {unit?.name}
                        </td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenItemDetails(item)}
                              className="p-1.5 text-slate-500 hover:text-amber-700 hover:bg-amber-100/70 rounded-lg transition-colors cursor-pointer"
                              title="عرض بطاقة الصنف وسبب الأرشفة"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleRestoreFromArchive(item)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                  title="استعادة الصنف"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>استعادة</span>
                                </button>
                                <button
                                  onClick={() => handleMoveArchiveToTrash(item)}
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                  title="نقل للمحذوفات"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Trash Items */}
      {activeTab === 'trash' && (
        <div>
          {deletedItems.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
                <Trash2 className="w-8 h-8" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">سلة المحذوفات فارغة</h3>
              <p className="text-xs text-slate-500">
                لا توجد أي أصناف محذوفة حالياً.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
                  <tr>
                    <th className="py-3.5 px-4">الصنف والرمز (انقر للتفاصيل)</th>
                    <th className="py-3.5 px-4">القسم</th>
                    <th className="py-3.5 px-4">الوحدة الأساسية</th>
                    <th className="py-3.5 px-4">الرصيد المحفوظ</th>
                    <th className="py-3.5 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {deletedItems.map((item) => {
                    const cat = categories.find((c) => c.id === item.categoryId);
                    const unit = units.find((u) => u.id === item.baseUnitId);
                    const stock = getItemStock(item.id);

                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-rose-50/40 transition-colors cursor-pointer group"
                        onClick={() => handleOpenItemDetails(item)}
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 group-hover:text-rose-800 transition-colors block">
                              {item.name}
                            </span>
                            <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded font-bold">
                              عرض التفاصيل والسبب
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">{item.code}</span>
                          {item.deleteReason && (
                            <span className="block text-[11px] text-rose-800 bg-rose-50 border border-rose-200/60 px-2 py-0.5 rounded-md mt-1 font-medium w-fit">
                              سبب الحذف: {item.deleteReason}
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-xs text-slate-600">{cat?.name || '-'}</td>
                        <td className="py-3.5 px-4 text-xs font-bold text-slate-700">{unit?.name || '-'}</td>
                        <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                          {stock} {unit?.name}
                        </td>
                        <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleOpenItemDetails(item)}
                              className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-100/70 rounded-lg transition-colors cursor-pointer"
                              title="عرض بطاقة الصنف وسبب الحذف"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {isAdmin && (
                              <>
                                <button
                                  onClick={() => handleRestoreFromTrash(item)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                  title="استعادة الصنف"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>استعادة</span>
                                </button>
                                <button
                                  onClick={() => handlePermanentDelete(item)}
                                  className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg transition-colors cursor-pointer"
                                  title="حذف نهائي"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>حذف نهائي</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Item Detail Modal (Displays complete data & reasons) */}
      <ItemArchiveDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        item={selectedDetailItem}
        mode={activeTab}
        onRestore={(it) => {
          if (activeTab === 'archive') {
            handleRestoreFromArchive(it);
          } else {
            handleRestoreFromTrash(it);
          }
        }}
        onMoveToTrash={handleMoveArchiveToTrash}
        onPermanentDelete={handlePermanentDelete}
      />

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        isDestructive={confirmState.isDestructive}
        confirmLabel={confirmState.confirmLabel || (confirmState.isDestructive ? 'تأكيد الحذف' : 'تأكيد الاستعادة')}
        requiresReason={confirmState.requiresReason}
        reasonLabel={confirmState.reasonLabel}
        reasonPlaceholder={confirmState.reasonPlaceholder}
        onConfirm={(reason) => {
          confirmState.action(reason);
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
        }}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
