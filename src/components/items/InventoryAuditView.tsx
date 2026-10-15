import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Search,
  Filter,
  Printer,
  Download,
  Boxes,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  Building2,
  Users,
  Eye,
  X,
  Calendar,
  CheckCircle2,
  Scale,
  Layers,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { Item, StockMovement, ItemStockSummary } from '../../types/inventory';
import { playNotificationSound } from '../../services/sound';

interface InventoryAuditViewProps {
  onBackToItems?: () => void;
  initialZeroStockOnly?: boolean;
  initialCategoryId?: string;
  initialSearchQuery?: string;
  initialInspectedItemId?: string;
  returnToReports?: () => void;
}

export const InventoryAuditView: React.FC<InventoryAuditViewProps> = ({
  onBackToItems,
  initialZeroStockOnly = false,
  initialCategoryId = 'ALL',
  initialSearchQuery = '',
  initialInspectedItemId,
  returnToReports,
}) => {
  const {
    items,
    movements,
    categories,
    units,
    branches,
    customers,
    companySettings,
    getItemStock,
    getItemStockSummary,
    getAllItemsSummary,
    adjustItemStock,
  } = useInventory();
  const { isAdmin } = useAuth();

  // Filters
  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(initialCategoryId || 'ALL');
  const [showZeroStock, setShowZeroStock] = useState(true);
  const [zeroStockOnly, setZeroStockOnly] = useState(initialZeroStockOnly);

  // Selected item modal for audit inspection
  const [inspectedItem, setInspectedItem] = useState<Item | null>(null);
  const [activeItemTab, setActiveItemTab] = useState<'out' | 'remaining' | 'all'>('out');

  // Stock Adjustment Modal state
  const [adjustingItem, setAdjustingItem] = useState<Item | null>(null);
  const [newStockInput, setNewStockInput] = useState<string>('');
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [isSubmittingAdjustment, setIsSubmittingAdjustment] = useState(false);

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingItem) return;
    const num = Number(newStockInput);
    if (isNaN(num) || num < 0) {
      alert('يرجى إدخال رصيد فعلي صحيح أكبر من أو يساوي الصفر');
      return;
    }
    if (!adjustmentReason.trim()) {
      alert('يرجى إدخال سبب التسوية / ملاحظات الجرد');
      return;
    }

    setIsSubmittingAdjustment(true);
    playNotificationSound('bell');
    const res = adjustItemStock({
      itemId: adjustingItem.id,
      newStock: num,
      reason: adjustmentReason,
      unitId: adjustingItem.baseUnitId,
    });
    setIsSubmittingAdjustment(false);

    if (res.success) {
      setAdjustingItem(null);
      setNewStockInput('');
      setAdjustmentReason('');
    }
  };

  // Print Preview Modal
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  // Auto-open inspected item if initialInspectedItemId is provided
  React.useEffect(() => {
    if (initialInspectedItemId) {
      const match = items.find((i) => i.id === initialInspectedItemId);
      if (match) {
        setInspectedItem(match);
      }
    }
  }, [initialInspectedItemId, items]);

  // Active items summaries
  const allSummaries = useMemo(() => {
    return getAllItemsSummary(false, false);
  }, [getAllItemsSummary]);

  // Filtered summaries
  const filteredSummaries = useMemo(() => {
    return allSummaries.filter((s) => {
      // Zero stock strictly only
      if (zeroStockOnly && s.currentStock > 0) {
        return false;
      }

      // Hide zero stock if showZeroStock is unchecked and not in zeroStockOnly mode
      if (!zeroStockOnly && !showZeroStock && s.currentStock <= 0) {
        return false;
      }

      // Category filter
      if (selectedCategoryId !== 'ALL' && s.item.categoryId !== selectedCategoryId) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (s.item.name || '').toLowerCase().includes(q);
        const matchCode = (s.item.code || '').toLowerCase().includes(q);
        const matchCat = (s.categoryName || '').toLowerCase().includes(q);
        if (!matchName && !matchCode && !matchCat) {
          return false;
        }
      }

      return true;
    });
  }, [allSummaries, selectedCategoryId, showZeroStock, zeroStockOnly, searchQuery]);

  // Statistics calculation
  const stats = useMemo(() => {
    const totalItems = allSummaries.length;
    let zeroCount = 0;
    let totalStockQty = 0;

    // Unit breakdown
    const unitMap: Record<string, number> = {};

    for (const s of allSummaries) {
      if (s.currentStock <= 0) {
        zeroCount++;
      } else {
        totalStockQty += s.currentStock;
        const uName = s.baseUnitName || 'وحدة';
        unitMap[uName] = (unitMap[uName] || 0) + s.currentStock;
      }
    }

    return {
      totalItems,
      zeroCount,
      totalStockQty: Math.round(totalStockQty * 100) / 100,
      unitBreakdown: Object.entries(unitMap).map(([unit, qty]) => ({
        unit,
        qty: Math.round(qty * 100) / 100,
      })),
    };
  }, [allSummaries]);

  // Movement history for inspected item
  const inspectedItemMovements = useMemo(() => {
    if (!inspectedItem) return [];
    return movements
      .filter((m) => m.itemId === inspectedItem.id)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [inspectedItem, movements]);

  // "الخارج": Outgoing movements
  const outMovements = useMemo(() => {
    return inspectedItemMovements
      .filter((m) => m.type === 'OUT')
      .slice()
      .reverse();
  }, [inspectedItemMovements]);

  // "الكل": Chronological movements with running balance calculation
  const allChronologicalMovementsWithBalance = useMemo(() => {
    let runningBalance = 0;
    const result = inspectedItemMovements.map((m) => {
      const factor = Number(m.factorApplied) > 0 ? Number(m.factorApplied) : 1;
      const baseQty =
        m.baseQuantity !== undefined && m.baseQuantity !== null
          ? Number(m.baseQuantity)
          : (Number(m.quantity) || 0) * factor;

      if (m.type === 'IN') {
        runningBalance += baseQty;
      } else if (m.type === 'OUT') {
        runningBalance -= baseQty;
      }

      const bal = Math.round(Math.max(0, runningBalance) * 1000) / 1000;
      return {
        ...m,
        calculatedBaseQty: baseQty,
        balanceAfter: bal,
      };
    });

    // Return newest first for display
    return result.reverse();
  }, [inspectedItemMovements]);

  // "المتبقي": Stock breakdown by branch / destination
  const stockByBranchBreakdown = useMemo(() => {
    if (!inspectedItem) return [];
    const branchMap: Record<string, { branchName: string; outQty: number }> = {};

    for (const m of inspectedItemMovements) {
      if (m.type === 'OUT' && (m.branchId || m.branchName)) {
        const bId = m.branchId || m.branchName || 'unknown';
        const bName = m.branchName || 'فرع مسجل';
        const factor = Number(m.factorApplied) > 0 ? Number(m.factorApplied) : 1;
        const bQty =
          m.baseQuantity !== undefined && m.baseQuantity !== null
            ? Number(m.baseQuantity)
            : (Number(m.quantity) || 0) * factor;

        if (!branchMap[bId]) {
          branchMap[bId] = { branchName: bName, outQty: 0 };
        }
        branchMap[bId].outQty += bQty;
      }
    }

    return Object.values(branchMap);
  }, [inspectedItem, inspectedItemMovements]);

  // Helper to get destination display text
  const getDestinationDisplay = (m: StockMovement) => {
    if (m.destinationName) return m.destinationName;
    if (m.branchName) return `فرع: ${m.branchName}`;
    if (m.customerName) return `عميل: ${m.customerName}`;
    if (m.destinationType === 'BRANCH') return 'فرع مخصص';
    if (m.destinationType === 'CUSTOMER') return 'عميل مخصص';
    return 'صرف عام';
  };

  // Helper unit name
  const getUnitName = (unitId: string) => {
    return units.find((u) => u.id === unitId)?.name || 'وحدة';
  };

  // Export to CSV
  const handleExportCSV = () => {
    playNotificationSound('bell');
    const headers = ['#', 'رمز الصنف (SKU)', 'اسم الصنف', 'القسم', 'الرصيد الحالي', 'الوحدة الأساسية', 'حالة التوفر'];
    const rows = filteredSummaries.map((s, index) => [
      index + 1,
      `"${s.item.code}"`,
      `"${s.item.name}"`,
      `"${s.categoryName}"`,
      s.currentStock,
      `"${s.baseUnitName}"`,
      s.currentStock <= 0 ? 'نفد (0)' : s.status === 'LOW_STOCK' ? 'منخفض' : 'متوفر',
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `تقرير_جرد_المخزون_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenPrint = () => {
    playNotificationSound('bell');
    setIsPrintModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Return to Reports Banner if arrived from ReportsView */}
      {returnToReports && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
              📊
            </div>
            <div>
              <div className="text-xs font-black text-emerald-950">
                أنت تتصفح الجرد عبر التحليلات والتقارير
              </div>
              <div className="text-[11px] text-emerald-800">
                {zeroStockOnly ? 'معاينة الأصناف التي رصيدها صفر' : 'معاينة تفاصيل أرصدة الجرد'}
              </div>
            </div>
          </div>
          <button
            onClick={returnToReports}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
          >
            <span>← العودة إلى التقارير والتحليلات</span>
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center shadow-xs">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight">جرد المخزون والتسوية</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
                  تقرير حي ومباشر
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                حصر شامل لجميع كميات الأصناف المتوفرة، حركات الصرف، والرصيد التراكمي
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={handleExportCSV}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-2xs"
            >
              <Download className="w-4 h-4 text-emerald-600" />
              <span>تصدير Excel/CSV</span>
            </button>

            <button
              onClick={handleOpenPrint}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>طباعة تقرير الجرد</span>
            </button>
          </div>
        </div>

        {/* Top Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5 pt-5 border-t border-slate-100">
          {/* Card 1: Total Items */}
          <div className="bg-slate-50 border border-slate-200/70 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-500 font-bold block">إجمالي الأصناف المسجلة</span>
              <span className="text-2xl font-black text-slate-900 font-mono mt-0.5 block">
                {stats.totalItems.toLocaleString('ar-SA')}
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5 block">صنف نشط في المستودع</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center">
              <Boxes className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Total Quantities */}
          <div className="bg-emerald-50/70 border border-emerald-200/60 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-emerald-800 font-bold block">إجمالي الأرصدة المتوفرة</span>
              <span className="text-2xl font-black text-emerald-950 font-mono mt-0.5 block">
                {stats.totalStockQty.toLocaleString('ar-SA')}
              </span>
              <div className="text-[10px] text-emerald-700 mt-0.5 line-clamp-1">
                {stats.unitBreakdown.map((u) => `${u.qty} ${u.unit}`).join(' + ') || 'رصيد فارغ'}
              </div>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
          </div>

          {/* Card 3: Zero Stock Items */}
          <div className="bg-rose-50/70 border border-rose-200/60 p-4 rounded-xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-rose-800 font-bold block">أصناف رصيدها صفر (نفدت)</span>
              <span className="text-2xl font-black text-rose-950 font-mono mt-0.5 block">
                {stats.zeroCount.toLocaleString('ar-SA')}
              </span>
              <span className="text-[10px] text-rose-700 mt-0.5 block">تحتاج إلى إعادة توريد فوري</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث بالاسم أو الرمز (SKU)..."
              className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:border-teal-500 focus:ring-1 focus:ring-teal-100 transition-colors"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-bold focus:bg-white focus:border-teal-500 cursor-pointer"
            >
              <option value="ALL">كل الأقسام</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Zero Stock Controls */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer select-none px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 flex-1">
              <input
                type="checkbox"
                checked={showZeroStock}
                onChange={(e) => setShowZeroStock(e.target.checked)}
                className="w-4 h-4 text-teal-600 rounded-md border-slate-300 focus:ring-teal-500 cursor-pointer"
              />
              <span className="truncate">إظهار الأصناف الصفرية</span>
            </label>

            <button
              onClick={() => {
                setZeroStockOnly((prev) => !prev);
                if (!zeroStockOnly) setShowZeroStock(true);
              }}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer border whitespace-nowrap ${
                zeroStockOnly
                  ? 'bg-rose-50 border-rose-300 text-rose-800 font-black shadow-xs'
                  : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
              title="تصفية لعرض الأصناف التي نفد رصيدها فقط"
            >
              {zeroStockOnly ? '✓ الأصناف الصفرية فقط' : 'الأصناف الصفرية فقط'}
            </button>
          </div>
        </div>

        {zeroStockOnly && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center justify-between">
            <span>تم تفعيل الفلتر: عرض الأصناف التي رصيدها صفر فقط ({filteredSummaries.length} صنف)</span>
            <button
              onClick={() => setZeroStockOnly(false)}
              className="text-rose-900 underline hover:text-rose-950 font-black cursor-pointer text-[11px]"
            >
              إلغاء وإظهار جميع الأصناف
            </button>
          </div>
        )}
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredSummaries.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400 mb-3">
              <Boxes className="w-7 h-7" />
            </div>
            <h4 className="text-sm font-black text-slate-800">لا توجد أصناف مطابقة</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              تأكد من شروط البحث أو قم بتفعيل خيار "إظهار الأصناف التي رصيدها صفر".
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                <tr>
                  <th className="p-3.5 text-center w-12">#</th>
                  <th className="p-3.5">الرمز (SKU)</th>
                  <th className="p-3.5">اسم الصنف</th>
                  <th className="p-3.5">القسم</th>
                  <th className="p-3.5 text-center">الرصيد الحالي</th>
                  <th className="p-3.5">الوحدة</th>
                  <th className="p-3.5 text-center">حالة التوفر</th>
                  <th className="p-3.5 text-center">فحص الجرد والحركات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSummaries.map((s, index) => {
                  const isZero = s.currentStock <= 0;
                  const isLow = s.status === 'LOW_STOCK';

                  return (
                    <tr
                      key={s.item.id}
                      onClick={() => setInspectedItem(s.item)}
                      className={`hover:bg-slate-50/80 transition-colors cursor-pointer group ${
                        isZero ? 'bg-rose-50/20' : ''
                      }`}
                    >
                      {/* Index */}
                      <td className="p-3.5 text-center text-slate-400 font-mono text-[11px]">
                        {index + 1}
                      </td>

                      {/* Code */}
                      <td className="p-3.5 font-mono font-bold text-slate-700 whitespace-nowrap">
                        {s.item.code}
                      </td>

                      {/* Name */}
                      <td className="p-3.5 font-black text-slate-900">
                        <div className="flex items-center gap-1.5">
                          <span>{s.item.name}</span>
                          {isZero && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                              نفد
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="p-3.5 text-slate-600 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
                          {s.categoryName}
                        </span>
                      </td>

                      {/* Stock Quantity */}
                      <td className="p-3.5 text-center font-mono font-black text-sm">
                        <span
                          className={
                            isZero
                              ? 'text-rose-600'
                              : isLow
                              ? 'text-amber-600'
                              : 'text-emerald-700'
                          }
                        >
                          {s.currentStock.toLocaleString('ar-SA')}
                        </span>
                      </td>

                      {/* Unit */}
                      <td className="p-3.5 text-slate-600 font-bold whitespace-nowrap">
                        {s.baseUnitName}
                      </td>

                      {/* Status Badge */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        {isZero ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            نفد من المخزون
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            منخفض (حد الطلب)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            متوفر بالمخزن
                          </span>
                        )}
                      </td>

                      {/* Action Button */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setInspectedItem(s.item);
                            }}
                            className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px]"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>فحص الجرد</span>
                          </button>

                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setAdjustingItem(s.item);
                                setNewStockInput(s.currentStock.toString());
                                setAdjustmentReason('');
                              }}
                              className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-orange-800 font-bold rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1 text-[11px] border border-orange-200"
                              title="تسوية جردية لتصحيح الرصيد"
                            >
                              <Scale className="w-3.5 h-3.5 text-orange-600" />
                              <span>تسوية جردية</span>
                            </button>
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

      {/* INSPECTED ITEM MODAL (3 TABS: الخارج / المتبقي / الكل) */}
      {inspectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-3xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-100 text-teal-800 flex items-center justify-center">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">{inspectedItem.name}</h3>
                    <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-800 font-mono text-[11px] font-bold">
                      {inspectedItem.code}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    الرصيد الفعلي المتوفر:{' '}
                    <strong className="font-mono text-emerald-700">
                      {getItemStock(inspectedItem.id)} {getUnitName(inspectedItem.baseUnitId)}
                    </strong>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setInspectedItem(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* TAB SELECTOR (الخارج / المتبقي / الكل) */}
            <div className="flex border-b border-slate-200 bg-slate-100/70 p-1.5 gap-1.5 text-xs font-bold">
              <button
                onClick={() => setActiveItemTab('out')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeItemTab === 'out'
                    ? 'bg-white text-rose-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-4 h-4 text-rose-600" />
                <span>الخارج ({outMovements.length})</span>
              </button>

              <button
                onClick={() => setActiveItemTab('remaining')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeItemTab === 'remaining'
                    ? 'bg-white text-teal-800 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Scale className="w-4 h-4 text-teal-600" />
                <span>المتبقي وتفصيل المواقع</span>
              </button>

              <button
                onClick={() => setActiveItemTab('all')}
                className={`flex-1 py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  activeItemTab === 'all'
                    ? 'bg-white text-blue-800 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-4 h-4 text-blue-600" />
                <span>الكل والرصيد التراكمي ({allChronologicalMovementsWithBalance.length})</span>
              </button>
            </div>

            {/* TAB CONTENT */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4">
              {/* TAB 1: الخارج (حركات الصرف اللي خرجت منه مع التاريخ والكمية والجهة) */}
              {activeItemTab === 'out' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>سجل حركات الصرف والخروج من المستودع:</span>
                    <span>
                      إجمالي المنصرف:{' '}
                      <strong className="text-rose-700 font-mono">
                        {outMovements
                          .reduce((acc, m) => acc + (m.baseQuantity || m.quantity), 0)
                          .toLocaleString('ar-SA')}{' '}
                        {getUnitName(inspectedItem.baseUnitId)}
                      </strong>
                    </span>
                  </div>

                  {outMovements.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs text-slate-500">لا توجد حركات صرف مسجلة لهذا الصنف حتى الآن.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">التاريخ والوقت</th>
                            <th className="p-3 text-center">الكمية المنصرفة</th>
                            <th className="p-3">الجهة المستلمة</th>
                            <th className="p-3">رقم السند / المرجع</th>
                            <th className="p-3">ملاحظات</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {outMovements.map((m) => (
                            <tr key={m.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                                {new Date(m.date).toLocaleString('ar-SA', {
                                  year: 'numeric',
                                  month: 'numeric',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </td>
                              <td className="p-3 text-center font-mono font-bold text-rose-700">
                                -{m.quantity} {getUnitName(m.unitId)}
                              </td>
                              <td className="p-3 font-bold text-slate-800">
                                <div className="flex items-center gap-1.5">
                                  {m.destinationType === 'BRANCH' ? (
                                    <Building2 className="w-3.5 h-3.5 text-amber-600" />
                                  ) : m.destinationType === 'CUSTOMER' ? (
                                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                                  ) : (
                                    <Boxes className="w-3.5 h-3.5 text-slate-400" />
                                  )}
                                  <span>{getDestinationDisplay(m)}</span>
                                </div>
                              </td>
                              <td className="p-3 font-mono text-slate-500">{m.referenceNumber || '-'}</td>
                              <td className="p-3 text-slate-500">{m.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 2: المتبقي (الرصيد الحالي وتفصيله حسب الفرع/الموقع لو متوفر) */}
              {activeItemTab === 'remaining' && (
                <div className="space-y-4">
                  {/* Current Summary Card */}
                  <div className="bg-gradient-to-r from-teal-900 to-slate-900 text-white p-5 rounded-2xl flex items-center justify-between">
                    <div>
                      <span className="text-xs text-teal-300 font-bold block">الرصيد الفعلي المتوفر بالمستودع:</span>
                      <div className="text-3xl font-black font-mono mt-1 text-white">
                        {getItemStock(inspectedItem.id).toLocaleString('ar-SA')}{' '}
                        <span className="text-sm font-normal text-teal-200">
                          {getUnitName(inspectedItem.baseUnitId)}
                        </span>
                      </div>
                      <span className="text-xs text-slate-300 mt-1 block">
                        حد الطلب الأدنى: {inspectedItem.minStockAlert || 0} {getUnitName(inspectedItem.baseUnitId)}
                      </span>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-white/10 text-teal-300 flex items-center justify-center">
                      <Scale className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Equivalent units breakdown */}
                  {inspectedItem.conversions && inspectedItem.conversions.length > 0 && (
                    <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl">
                      <h4 className="text-xs font-bold text-slate-800 mb-2">
                        معادلة الرصيد الحالي حسب الوحدات البديلة والتحويلات:
                      </h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {inspectedItem.conversions.map((c) => {
                          const stock = getItemStock(inspectedItem.id);
                          const equiv = Math.round((stock / c.factorToBase) * 100) / 100;
                          return (
                            <div key={c.unitId} className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs">
                              <span className="text-slate-500 block text-[11px]">{getUnitName(c.unitId)}:</span>
                              <span className="font-mono font-bold text-slate-900 text-sm">{equiv}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Distribution to Branches */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-800">
                      توزيع الشحنات والصادر الموجه للفروع المسجلة:
                    </h4>
                    {stockByBranchBreakdown.length === 0 ? (
                      <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-500">
                        لم يتم صرف أي كميات لفروع أو مواقع فرعية محددة حتى الآن.
                      </div>
                    ) : (
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                            <tr>
                              <th className="p-3">اسم الفرع / الموقع</th>
                              <th className="p-3 text-center">إجمالي الكمية المصروفة للفرع</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {stockByBranchBreakdown.map((b, i) => (
                              <tr key={i} className="hover:bg-slate-50">
                                <td className="p-3 font-bold text-slate-800 flex items-center gap-2">
                                  <Building2 className="w-4 h-4 text-amber-600" />
                                  <span>{b.branchName}</span>
                                </td>
                                <td className="p-3 text-center font-mono font-bold text-slate-900">
                                  {b.outQty.toLocaleString('ar-SA')} {getUnitName(inspectedItem.baseUnitId)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB 3: الكل (كل حركاته وارد وصادر ومرتجع بالترتيب الزمني مع الرصيد بعد كل حركة) */}
              {activeItemTab === 'all' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
                    <span>السجل الزمني التراكمي الشامل لجميع الحركات:</span>
                    <span>إجمالي الحركات: {allChronologicalMovementsWithBalance.length}</span>
                  </div>

                  {allChronologicalMovementsWithBalance.length === 0 ? (
                    <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-100">
                      <p className="text-xs text-slate-500">لا توجد أي حركات مسجلة لهذا الصنف.</p>
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-3">نوع الحركة</th>
                            <th className="p-3">التاريخ والوقت</th>
                            <th className="p-3 text-center">الكمية</th>
                            <th className="p-3">الجهة / المرجع</th>
                            <th className="p-3 text-center bg-teal-50 text-teal-900">
                              الرصيد بعد الحركة
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {allChronologicalMovementsWithBalance.map((m) => {
                            const isIn = m.type === 'IN';
                            return (
                              <tr key={m.id} className="hover:bg-slate-50/50">
                                <td className="p-3 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                                      isIn
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : 'bg-rose-50 text-rose-800 border border-rose-200'
                                    }`}
                                  >
                                    {isIn ? <ArrowDownLeft className="w-3 h-3 text-emerald-600" /> : <ArrowUpRight className="w-3 h-3 text-rose-600" />}
                                    {isIn ? 'وارد (توريد)' : 'صادر (صرف)'}
                                  </span>
                                </td>
                                <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                                  {new Date(m.date).toLocaleString('ar-SA', {
                                    year: 'numeric',
                                    month: 'numeric',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </td>
                                <td
                                  className={`p-3 text-center font-mono font-bold ${
                                    isIn ? 'text-emerald-700' : 'text-rose-700'
                                  }`}
                                >
                                  {isIn ? '+' : '-'}
                                  {m.quantity} {getUnitName(m.unitId)}
                                </td>
                                <td className="p-3 text-slate-700">
                                  <div className="font-bold">{getDestinationDisplay(m)}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {m.referenceNumber || m.id}
                                  </div>
                                </td>
                                <td className="p-3 text-center font-mono font-black text-sm text-teal-900 bg-teal-50/40">
                                  {m.balanceAfter.toLocaleString('ar-SA')}{' '}
                                  <span className="text-[10px] font-normal text-slate-500">
                                    {getUnitName(inspectedItem.baseUnitId)}
                                  </span>
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
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-mono">
                بيانات الجرد مستندة إلى حركات المخزون الفعلية
              </span>
              <button
                onClick={() => setInspectedItem(null)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRINT PREVIEW MODAL */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-4xl w-full border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Printer className="w-4 h-4 text-emerald-600" />
                <span>معاينة تقرير جرد المخزون الرسمي للطباعة</span>
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" />
                  <span>طباعة الآن</span>
                </button>
                <button
                  onClick={() => setIsPrintModalOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 bg-slate-200/50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="p-8 overflow-y-auto flex-1 bg-white printable-area font-sans text-right" dir="rtl">
              {/* Document Header */}
              <div className="border-b-2 border-slate-900 pb-5 mb-6 flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-black text-slate-950">
                    {companySettings?.name || 'مؤسسة مدهال الطيب للتجارة'}
                  </h1>
                  <p className="text-xs text-slate-600 mt-1">
                    تقرير جرد المخزون الفعلي والتسوية الدورية
                  </p>
                  {companySettings?.taxId && (
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      الرقم الضريبي: {companySettings.taxId}
                    </p>
                  )}
                </div>
                <div className="text-left text-xs text-slate-500 font-mono">
                  <div>تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</div>
                  <div>وقت الإصدار: {new Date().toLocaleTimeString('ar-SA')}</div>
                  <div>المسؤول: {companySettings?.managerName || 'مدير المستودع'}</div>
                </div>
              </div>

              {/* Summary Band */}
              <div className="grid grid-cols-3 gap-3 bg-slate-100 p-4 rounded-xl mb-6 text-xs text-slate-800">
                <div>
                  <span className="text-slate-500 block">إجمالي الأصناف:</span>
                  <span className="font-bold text-base font-mono">{filteredSummaries.length} صنف</span>
                </div>
                <div>
                  <span className="text-slate-500 block">إجمالي الكميات المسجلة:</span>
                  <span className="font-bold text-base font-mono">
                    {filteredSummaries.reduce((acc, s) => acc + s.currentStock, 0).toLocaleString('ar-SA')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 block">أصناف رصيدها صفر:</span>
                  <span className="font-bold text-base font-mono text-rose-700">
                    {filteredSummaries.filter((s) => s.currentStock <= 0).length} صنف
                  </span>
                </div>
              </div>

              {/* Table */}
              <table className="w-full text-right text-xs border-collapse border border-slate-300">
                <thead>
                  <tr className="bg-slate-200 text-slate-900 font-bold border-b border-slate-300">
                    <th className="p-2 border border-slate-300 text-center w-10">#</th>
                    <th className="p-2 border border-slate-300">الرمز (SKU)</th>
                    <th className="p-2 border border-slate-300">اسم الصنف</th>
                    <th className="p-2 border border-slate-300">القسم</th>
                    <th className="p-2 border border-slate-300 text-center">الرصيد الدفتري</th>
                    <th className="p-2 border border-slate-300">الوحدة</th>
                    <th className="p-2 border border-slate-300 text-center w-28">الجرد الفعلي</th>
                    <th className="p-2 border border-slate-300 text-center w-28">الفارق (+/-)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.map((s, idx) => (
                    <tr key={s.item.id} className="border-b border-slate-200">
                      <td className="p-2 border border-slate-300 text-center font-mono">{idx + 1}</td>
                      <td className="p-2 border border-slate-300 font-mono font-bold">{s.item.code}</td>
                      <td className="p-2 border border-slate-300 font-bold">{s.item.name}</td>
                      <td className="p-2 border border-slate-300">{s.categoryName}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono font-bold">
                        {s.currentStock}
                      </td>
                      <td className="p-2 border border-slate-300">{s.baseUnitName}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-slate-300">
                        [ &nbsp; &nbsp; &nbsp; &nbsp; ]
                      </td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-slate-300">
                        [ &nbsp; &nbsp; &nbsp; &nbsp; ]
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Signatures Footer */}
              <div className="grid grid-cols-3 gap-6 pt-12 mt-8 text-center text-xs font-bold border-t border-slate-300">
                <div>
                  <p className="text-slate-600 mb-10">أمين المستودع</p>
                  <p className="border-t border-dashed border-slate-400 pt-2 text-slate-800">
                    التوقيع: ____________________
                  </p>
                </div>
                <div>
                  <p className="text-slate-600 mb-10">رئيس لجنة الجرد</p>
                  <p className="border-t border-dashed border-slate-400 pt-2 text-slate-800">
                    التوقيع: ____________________
                  </p>
                </div>
                <div>
                  <p className="text-slate-600 mb-10">اعتماد الإدارة</p>
                  <p className="border-t border-dashed border-slate-400 pt-2 text-slate-800">
                    الختم والتوقيع: ____________________
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* STOCK ADJUSTMENT MODAL */}
      {adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-orange-100 text-orange-700 flex items-center justify-center">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">تسوية جردية للصنف</h3>
                  <p className="text-xs text-slate-500">{adjustingItem.name} ({adjustingItem.code})</p>
                </div>
              </div>
              <button
                onClick={() => setAdjustingItem(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-600 font-bold">الرصيد المسجل حالياً:</span>
                <span className="font-mono font-black text-base text-slate-900">
                  {getItemStock(adjustingItem.id)} {units.find((u) => u.id === adjustingItem.baseUnitId)?.name || 'وحدة'}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  الرصيد الفعلي الجديد بعد الجرد (إلزامي):
                </label>
                <input
                  type="number"
                  step="any"
                  value={newStockInput}
                  onChange={(e) => setNewStockInput(e.target.value)}
                  placeholder="أدخل الكمية الفعلية الصحيحة..."
                  required
                  autoFocus
                  className="w-full px-3.5 py-3 bg-slate-50 border border-slate-300 focus:border-orange-500 rounded-xl text-sm font-mono font-bold text-slate-900 outline-hidden transition-colors"
                />
              </div>

              {/* Difference preview */}
              {newStockInput !== '' && !isNaN(Number(newStockInput)) && (
                (() => {
                  const curr = getItemStock(adjustingItem.id);
                  const diff = Number(newStockInput) - curr;
                  return (
                    <div className={`p-3 rounded-xl text-xs font-bold flex items-center justify-between border ${
                      diff > 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                        : diff < 0
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}>
                      <span>مقدار الفرق (الفائض / العجز):</span>
                      <span className="font-mono text-sm">
                        {diff > 0 ? `+${diff}` : diff} {units.find((u) => u.id === adjustingItem.baseUnitId)?.name || 'وحدة'}
                      </span>
                    </div>
                  );
                })()
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  سبب التسوية / ملاحظات الجرد (إلزامي):
                </label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  placeholder="مثال: تصحيح خطأ إدخال، تلف جزء من البضاعة، عجز جرد فعلي..."
                  required
                  rows={3}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 focus:border-orange-500 rounded-xl text-xs text-slate-900 outline-hidden transition-colors resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmittingAdjustment}
                  className="flex-1 py-3 px-4 bg-orange-600 hover:bg-orange-500 text-white rounded-xl font-bold text-sm shadow-md shadow-orange-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Scale className="w-4 h-4" />
                  <span>حفظ واعتماد التسوية</span>
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustingItem(null)}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-sm transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
