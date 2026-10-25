import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Search,
  Calendar,
  Filter,
  Trash2,
  Plus,
  ShieldAlert,
  CheckCircle2,
  Factory,
  Package,
  User,
  RotateCcw,
  PackageCheck,
  Check,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { DamagedModal } from './DamagedModal';
import { DamagedRecoveryModal } from './DamagedRecoveryModal';
import { DamagedSection, DamagedRecord } from '../../types/inventory';

type PeriodFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH';
type SectionFilter = 'ALL' | DamagedSection;
type RecoveryStatusFilter = 'ALL' | 'ACTIVE' | 'PARTIAL' | 'FULL';

export const DamagedView: React.FC = () => {
  const { damagedRecords, items, units, categories, deleteDamagedRecord } = useInventory();
  const { isAdmin } = useAuth();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRecoveryModalOpen, setIsRecoveryModalOpen] = useState(false);
  const [preselectedRecord, setPreselectedRecord] = useState<DamagedRecord | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [sectionFilter, setSectionFilter] = useState<SectionFilter>('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('ALL');
  const [selectedReason, setSelectedReason] = useState<string>('ALL');
  const [recoveryFilter, setRecoveryFilter] = useState<RecoveryStatusFilter>('ALL');

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  // Extract unique reasons for filtering
  const allReasons = useMemo(() => {
    const set = new Set<string>();
    damagedRecords.forEach((r) => {
      if (r.reason) set.add(r.reason);
    });
    return Array.from(set);
  }, [damagedRecords]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .split('T')[0];

    return damagedRecords.filter((r) => {
      const item = items.find((i) => i.id === r.itemId);
      const q = searchQuery.toLowerCase().trim();

      // Search matching
      const matchesSearch =
        !q ||
        (item?.name || '').toLowerCase().includes(q) ||
        (item?.code || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q) ||
        (r.notes || '').toLowerCase().includes(q);

      // Section filter
      const matchesSection = sectionFilter === 'ALL' || r.section === sectionFilter;

      // Reason filter
      const matchesReason = selectedReason === 'ALL' || r.reason === selectedReason;

      // Period filter
      let matchesPeriod = true;
      const recordDateStr = (r.date || '').split('T')[0];
      if (periodFilter === 'TODAY') {
        matchesPeriod = recordDateStr === todayStr;
      } else if (periodFilter === 'WEEK') {
        matchesPeriod = recordDateStr >= sevenDaysAgoStr;
      } else if (periodFilter === 'MONTH') {
        matchesPeriod = recordDateStr >= startOfMonth;
      }

      // Recovery filter
      let matchesRecovery = true;
      const recBase = r.recoveredBaseQuantity || 0;
      const remBase = Math.round((r.baseQuantity - recBase) * 1000) / 1000;
      if (recoveryFilter === 'ACTIVE') {
        matchesRecovery = recBase === 0;
      } else if (recoveryFilter === 'PARTIAL') {
        matchesRecovery = recBase > 0 && remBase > 0.001;
      } else if (recoveryFilter === 'FULL') {
        matchesRecovery = remBase <= 0.001;
      }

      return matchesSearch && matchesSection && matchesReason && matchesPeriod && matchesRecovery;
    });
  }, [damagedRecords, items, searchQuery, sectionFilter, selectedReason, periodFilter, recoveryFilter]);

  // Statistics
  const stats = useMemo(() => {
    let totalQty = 0;
    let recoveredQty = 0;
    let generalQty = 0;
    let prodQty = 0;

    damagedRecords.forEach((r) => {
      const base = r.baseQuantity || 0;
      const rec = r.recoveredBaseQuantity || 0;
      totalQty += base;
      recoveredQty += rec;
      if (r.section === 'GENERAL') {
        generalQty += base;
      } else {
        prodQty += base;
      }
    });

    const netQty = Math.max(0, Math.round((totalQty - recoveredQty) * 1000) / 1000);

    return {
      count: damagedRecords.length,
      totalQty: Math.round(totalQty * 1000) / 1000,
      recoveredQty: Math.round(recoveredQty * 1000) / 1000,
      netQty,
      generalQty: Math.round(generalQty * 1000) / 1000,
      prodQty: Math.round(prodQty * 1000) / 1000,
    };
  }, [damagedRecords]);

  const handleDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deleteId) return;
    await deleteDamagedRecord(deleteId, deleteReason);
    setDeleteId(null);
    setDeleteReason('');
  };

  const handleOpenRecovery = (record?: DamagedRecord) => {
    setPreselectedRecord(record || null);
    setIsRecoveryModalOpen(true);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Top Banner / Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-inner">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">سجل التلف والمفقودات</h2>
            <p className="text-xs text-slate-500">
              إدارة الكميات التالفة ومتابعة ما تم استرداده وإعادته للمخزون بعد الإصلاح والتأهيل
            </p>
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => handleOpenRecovery()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
              title="إعادة إدخال صنف تم إصلاحه أو تأهيله أو العثور عليه إلى المخزون"
            >
              <RotateCcw className="w-4 h-4" />
              <span>راجع من التالف / استرداد للمخزون</span>
            </button>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>تسجيل صنف تالف جديد</span>
            </button>
          </div>
        )}
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold block mb-1">إجمالي عمليات التلف</span>
            <span className="text-xl font-black font-mono text-slate-900">{stats.count} عملية</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold block mb-1">إجمالي الكميات التالفة</span>
            <span className="text-xl font-black font-mono text-rose-700">{stats.totalQty}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold block mb-1">راجع من التالف (المسترد)</span>
            <span className="text-xl font-black font-mono text-emerald-700">+{stats.recoveredQty}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
            <RotateCcw className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-slate-500 text-xs font-bold block mb-1">صافي التالف الفعلي المتبقي</span>
            <span className="text-xl font-black font-mono text-amber-700">{stats.netQty}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filters & Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث بالصنف، الكود، السبب، أو الملاحظات..."
              className="w-full pl-3.5 pr-10 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
            />
          </div>

          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value as SectionFilter)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
          >
            <option value="ALL">جميع الأقسام</option>
            <option value="GENERAL">المخزون العام</option>
            <option value="PRODUCTION">الإنتاج والتصنيع</option>
          </select>

          <select
            value={recoveryFilter}
            onChange={(e) => setRecoveryFilter(e.target.value as RecoveryStatusFilter)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
          >
            <option value="ALL">جميع حالات الاسترداد</option>
            <option value="ACTIVE">قيد التلف (لم يسترد شيء)</option>
            <option value="PARTIAL">استرداد جزئي</option>
            <option value="FULL">مسترد بالكامل للمخزون</option>
          </select>

          <select
            value={selectedReason}
            onChange={(e) => setSelectedReason(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
          >
            <option value="ALL">جميع الأسباب</option>
            {allReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <select
            value={periodFilter}
            onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
          >
            <option value="ALL">كل الفترات</option>
            <option value="TODAY">اليوم</option>
            <option value="WEEK">آخر 7 أيام</option>
            <option value="MONTH">الشهر الحالي</option>
          </select>
        </div>
      </div>

      {/* Records Table / List */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-xs">
        {filteredRecords.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-black text-slate-800">لا توجد سجلات تالف مطابقة للفلاتر</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              يمكنك تسجيل صنف تالف جديد أو تسجيل صنف راجع من التالف باستخدام الأزرار أعلاه.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5 pr-5">التاريخ والوقت</th>
                  <th className="p-3.5">القسم</th>
                  <th className="p-3.5">الصنف</th>
                  <th className="p-3.5 text-center">الكمية التالفة</th>
                  <th className="p-3.5 text-center">راجع من التالف</th>
                  <th className="p-3.5 text-center">صافي التالف المتبقي</th>
                  <th className="p-3.5">سبب التلف</th>
                  <th className="p-3.5">الملاحظات</th>
                  <th className="p-3.5">المستخدم</th>
                  {isAdmin && <th className="p-3.5 pl-5 text-center">إجراءات</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => {
                  const item = items.find((i) => i.id === r.itemId);
                  const unit = units.find((u) => u.id === r.unitId);
                  const category = categories.find((c) => c.id === item?.categoryId);
                  const isGen = r.section === 'GENERAL';

                  const recoveredQty = r.recoveredQuantity || 0;
                  const recoveredBase = r.recoveredBaseQuantity || 0;
                  const factor = r.factorApplied || 1;
                  const remainingBase = Math.max(0, Math.round((r.baseQuantity - recoveredBase) * 1000) / 1000);
                  const remainingUnitQty = Math.round((remainingBase / factor) * 1000) / 1000;
                  const isFullyRecovered = remainingBase <= 0.001;

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition">
                      <td className="p-3.5 pr-5 text-slate-600 font-medium whitespace-nowrap">
                        {new Date(r.date).toLocaleString('ar-SA', {
                          year: 'numeric',
                          month: 'numeric',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>

                      <td className="p-3.5 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black ${
                            isGen
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}
                        >
                          {isGen ? <Package className="w-3.5 h-3.5" /> : <Factory className="w-3.5 h-3.5" />}
                          <span>{isGen ? 'المخزون العام' : 'الإنتاج والتصنيع'}</span>
                        </span>
                      </td>

                      <td className="p-3.5">
                        <div className="font-black text-slate-900">{item?.name || 'صنف محذوف'}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                          <span className="font-mono bg-slate-100 px-1 rounded">{item?.code || '-'}</span>
                          {category && <span>• {category.name}</span>}
                        </div>
                      </td>

                      <td className="p-3.5 text-center font-mono font-black text-rose-700 text-sm whitespace-nowrap">
                        {r.quantity} {unit?.name || 'وحدة'}
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        {recoveredQty > 0 ? (
                          <span className="inline-flex items-center gap-1 font-mono font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-xs">
                            <RotateCcw className="w-3 h-3 text-emerald-600" />
                            <span>+{recoveredQty} {unit?.name || ''}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono text-xs">-</span>
                        )}
                      </td>

                      <td className="p-3.5 text-center whitespace-nowrap">
                        {isFullyRecovered ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" />
                            <span>مسترد بالكامل</span>
                          </span>
                        ) : (
                          <span className="font-mono font-black text-amber-800 text-xs bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
                            {remainingUnitQty} {unit?.name || ''}
                          </span>
                        )}
                      </td>

                      <td className="p-3.5 font-bold text-slate-800">{r.reason}</td>

                      <td className="p-3.5 text-slate-600 max-w-xs truncate" title={r.notes || ''}>
                        {r.notes || '-'}
                      </td>

                      <td className="p-3.5 text-slate-500 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-slate-400" />
                          <span>{r.createdByName || 'إدارة النظام'}</span>
                        </div>
                      </td>

                      {isAdmin && (
                        <td className="p-3.5 pl-5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Recover from Damaged Button */}
                            <button
                              onClick={() => handleOpenRecovery(r)}
                              disabled={isFullyRecovered}
                              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isFullyRecovered
                                  ? 'text-slate-300 cursor-not-allowed'
                                  : 'text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800'
                              }`}
                              title={
                                isFullyRecovered
                                  ? 'تم استرداد كامل الكمية التالفة لهذا السجل'
                                  : 'تسجيل راجع من التالف وإعادة الكمية للمخزون'
                              }
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>

                            {/* Delete Record Button */}
                            <button
                              onClick={() => setDeleteId(r.id)}
                              className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف سجل التلف واستعادة الرصيد"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 text-right">
            <h3 className="text-base font-black text-slate-900 mb-2">تأكيد حذف سجل التلف</h3>
            <p className="text-xs text-slate-500 mb-4">
              سيتم حذف سجل التلف هذا واستعادة الكمية التالفة تلقائياً إلى رصيد المستودع. يرجى ذكر السبب:
            </p>
            <form onSubmit={handleDeleteSubmit} className="space-y-4 text-xs">
              <input
                type="text"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                placeholder="سبب الحذف واستعادة الرصيد..."
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                required
              />
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeleteId(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm cursor-pointer"
                >
                  تأكيد الحذف والاستعادة
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Modal */}
      <DamagedModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      {/* Recovery / Restored from Damaged Modal */}
      <DamagedRecoveryModal
        isOpen={isRecoveryModalOpen}
        onClose={() => {
          setIsRecoveryModalOpen(false);
          setPreselectedRecord(null);
        }}
        preselectedRecord={preselectedRecord}
      />
    </div>
  );
};
