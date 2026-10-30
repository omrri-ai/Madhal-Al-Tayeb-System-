import React, { useState, useMemo } from 'react';
import {
  Factory,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  Calendar,
  Printer,
  Download,
  Filter,
  Layers,
  FileText,
  Boxes,
  TrendingDown,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { StockMovement, Item, Unit, Category } from '../../types/inventory';
import { FactoryMovementModal } from './FactoryMovementModal';
import { FactoryVoucherModal } from './FactoryVoucherModal';
import { deduplicateById } from '../../utils/arabicSearch';
import { UniversalReportModal } from '../reports/UniversalReportModal';
import { computeReportDateRange, isRecordInDateRange } from '../../utils/reportDateFilters';

interface ProductionViewProps {
  onOpenAddItem?: () => void;
}

type PeriodFilter = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM';
type TypeFilter = 'ALL' | 'MFG_OUT' | 'MFG_IN';

export const ProductionView: React.FC<ProductionViewProps> = () => {
  const { movements, items, units, categories, getItemStock } = useInventory();
  const { isAdmin } = useAuth();

  // Modals state
  const [modalType, setModalType] = useState<'MFG_OUT' | 'MFG_IN' | null>(null);
  const [voucherMovement, setVoucherMovement] = useState<StockMovement | null>(null);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');

  // Identify all factory operations from movements collection
  const factoryMovements = useMemo(() => {
    const list = movements.filter((m) => {
      if (!m) return false;
      const item = items.find((i) => i.id === m.itemId);
      return (
        m.type === 'MFG_OUT' ||
        m.type === 'MFG_IN' ||
        m.type === 'PRODUCTION_RECEIPT' ||
        m.type === 'PRODUCTION_DISPATCH' ||
        m.type === 'PRODUCTION_RETURN' ||
        (m.type as string) === 'خروج للمصنع' ||
        (m.type as string) === 'وارد من المصنع' ||
        Boolean(
          m.referenceNumber &&
            (m.referenceNumber.startsWith('MFG-') || m.referenceNumber.startsWith('PRD-'))
        ) ||
        m.destinationType === 'PRODUCTION' ||
        m.destinationType === 'FACTORY' ||
        (item?.isProductionItem && (m.type === 'IN' || m.type === 'OUT'))
      );
    });
    return deduplicateById(list);
  }, [movements, items]);

  // Filtered movements based on search and Riyadh standardized date ranges
  const filteredMovements = useMemo(() => {
    const activeRange = computeReportDateRange(
      periodFilter === 'TODAY'
        ? 'today'
        : periodFilter === 'WEEK'
        ? 'this_week'
        : periodFilter === 'MONTH'
        ? 'this_month'
        : periodFilter === 'CUSTOM'
        ? 'custom'
        : 'all',
      customStartDate,
      customEndDate
    );

    return factoryMovements.filter((m) => {
      const item = items.find((i) => i.id === m.itemId);
      const q = searchQuery.toLowerCase().trim();

      // Search matching (item name, SKU code, reference voucher number, notes)
      const matchesSearch =
        !q ||
        (item?.name || '').toLowerCase().includes(q) ||
        (item?.code || '').toLowerCase().includes(q) ||
        (m.referenceNumber || '').toLowerCase().includes(q) ||
        (m.notes || '').toLowerCase().includes(q);

      // Type filter matching
      const isOutMovement = Boolean(
        m.type === 'MFG_OUT' ||
        m.type === 'OUT' ||
        m.type === 'PRODUCTION_DISPATCH' ||
        (m.type as string) === 'خروج للمصنع' ||
        (m.referenceNumber && m.referenceNumber.startsWith('MFG-OUT-'))
      );

      const isInMovement = Boolean(
        m.type === 'MFG_IN' ||
        m.type === 'IN' ||
        m.type === 'PRODUCTION_RECEIPT' ||
        m.type === 'PRODUCTION_RETURN' ||
        (m.type as string) === 'وارد من المصنع' ||
        (m.referenceNumber && m.referenceNumber.startsWith('MFG-IN-'))
      );

      let matchesType = true;
      if (typeFilter === 'MFG_OUT') {
        matchesType = isOutMovement;
      } else if (typeFilter === 'MFG_IN') {
        matchesType = isInMovement;
      }

      // Period filter matching using exact Riyadh boundary check
      const matchesPeriod = isRecordInDateRange(m.date, activeRange);

      return matchesSearch && matchesType && matchesPeriod;
    });
  }, [factoryMovements, items, searchQuery, typeFilter, periodFilter, customStartDate, customEndDate]);

  // Statistics calculation for factory operations
  const stats = useMemo(() => {
    let outCount = 0;
    let inCount = 0;
    let totalOutBase = 0;
    let totalInBase = 0;

    for (const m of factoryMovements) {
      const isOut =
        m.type === 'MFG_OUT' ||
        m.type === 'OUT' ||
        m.type === 'PRODUCTION_DISPATCH' ||
        (m.type as string) === 'خروج للمصنع' ||
        (m.referenceNumber && m.referenceNumber.startsWith('MFG-OUT-'));

      if (isOut) {
        outCount++;
        totalOutBase += m.baseQuantity || 0;
      } else {
        inCount++;
        totalInBase += m.baseQuantity || 0;
      }
    }

    return {
      totalCount: factoryMovements.length,
      outCount,
      inCount,
      totalOutBase: Math.round(totalOutBase * 1000) / 1000,
      totalInBase: Math.round(totalInBase * 1000) / 1000,
    };
  }, [factoryMovements]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredMovements.length === 0) return;

    const headers = [
      'رقم السند',
      'التاريخ والوقت',
      'نوع الحركة',
      'رمز الصنف',
      'اسم الصنف',
      'الكمية المسجلة',
      'الوحدة',
      'المعادل بالوحدة الأساسية',
      'الملاحظات',
    ];

    const rows = filteredMovements.map((m) => {
      const item = items.find((i) => i.id === m.itemId);
      const unit = units.find((u) => u.id === m.unitId);
      const baseUnit = units.find((u) => u.id === item?.baseUnitId);

      const isOut =
        m.type === 'MFG_OUT' ||
        m.type === 'OUT' ||
        m.type === 'PRODUCTION_DISPATCH' ||
        (m.type as string) === 'خروج للمصنع' ||
        (m.referenceNumber && m.referenceNumber.startsWith('MFG-OUT-'));

      return [
        m.referenceNumber || m.id,
        new Date(m.date).toLocaleString('ar-SA'),
        isOut ? 'خروج للمصنع' : 'وارد من المصنع',
        item?.code || '',
        item?.name || '',
        m.quantity,
        unit?.name || '',
        `${m.baseQuantity} ${baseUnit?.name || ''}`,
        m.notes || '',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((row) => row.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `سجل_عمليات_المصنع_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-indigo-950 text-white p-6 sm:p-7 rounded-3xl shadow-md border border-slate-700/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div className="w-13 h-13 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/10 shadow-inner">
            <Factory className="w-7 h-7 text-indigo-300" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">قسم الإنتاج والتصنيع</h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
              تسجيل ما يخرج إلى المصنع وما يعود منه مع تحديث الأرصدة تلقائياً وإصدار السندات الرسمية
            </p>
          </div>
        </div>

        {/* Quick Stats in Banner */}
        <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-white/10 self-stretch sm:self-auto justify-around">
          <div className="text-center px-2">
            <div className="text-[10px] text-slate-400 font-bold">إجمالي العمليات</div>
            <div className="font-mono text-base font-black text-white">{stats.totalCount}</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center px-2">
            <div className="text-[10px] text-rose-300 font-bold">خروج للمصنع</div>
            <div className="font-mono text-base font-black text-rose-400">{stats.outCount}</div>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center px-2">
            <div className="text-[10px] text-emerald-300 font-bold">وارد من المصنع</div>
            <div className="font-mono text-base font-black text-emerald-400">{stats.inCount}</div>
          </div>
        </div>
      </div>

      {/* 2. The Two Main Action Buttons (خروج للمصنع & وارد من المصنع) or View-Only Banner */}
      {isAdmin ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
          {/* Button 1: خروج للمصنع */}
          <button
            onClick={() => setModalType('MFG_OUT')}
            className="group relative bg-white hover:bg-rose-50/40 p-6 rounded-3xl border-2 border-rose-200/80 hover:border-rose-400 shadow-sm hover:shadow-md transition-all text-right flex items-center justify-between overflow-hidden cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center group-hover:scale-105 group-hover:bg-rose-600 group-hover:text-white transition duration-200 shadow-xs">
                <ArrowUpRight className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-rose-700 transition">
                    خروج للمصنع
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 font-black">
                    يخصم من المخزون
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  صرف مواد خام أو أصناف إلى المصنع، مع التحقق الفوري من توفر الرصيد الكافي
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 text-slate-400 group-hover:bg-rose-100 group-hover:text-rose-700 transition">
              <span className="text-base font-bold">←</span>
            </div>
          </button>

          {/* Button 2: وارد من المصنع */}
          <button
            onClick={() => setModalType('MFG_IN')}
            className="group relative bg-white hover:bg-emerald-50/40 p-6 rounded-3xl border-2 border-emerald-200/80 hover:border-emerald-400 shadow-sm hover:shadow-md transition-all text-right flex items-center justify-between overflow-hidden cursor-pointer"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 group-hover:bg-emerald-600 group-hover:text-white transition duration-200 shadow-xs">
                <ArrowDownLeft className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-emerald-700 transition">
                    وارد من المصنع
                  </h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-black">
                    يضاف للمخزون
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  استلام منتجات جاهزة أو بضائع مصنعة من المصنع وإضافتها مباشرة لرصيد المخزون
                </p>
              </div>
            </div>
            <div className="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 text-slate-400 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition">
              <span className="text-base font-bold">←</span>
            </div>
          </button>
        </div>
      ) : (
        <div className="bg-teal-50 border border-teal-200 rounded-3xl p-4 sm:p-5 flex items-center gap-3 text-teal-900 text-xs">
          <Factory className="w-6 h-6 text-teal-700 shrink-0" />
          <div className="flex-1">
            <span className="font-bold text-sm block mb-0.5">وضع مسؤول المصنع — مشاهدة فقط:</span>
            <p className="text-teal-800">
              يمكنك البحث في سجل العمليات أدناه، وتصفية الحركات حسب النوع والفترة، وطباعة السندات وتصدير ملفات CSV. عمليات صرف المواد واستلام البضائع مقتصرة على وضع المدير.
            </p>
          </div>
        </div>
      )}

      {/* 3. Search & Filters Bar */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ابحث باسم الصنف، رمزه (SKU)، رقم السند، أو الملاحظة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-2xl border border-slate-200 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-slate-50/50"
            />
          </div>

          {/* Movement Type Filter Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold self-start sm:self-auto">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl transition ${
                typeFilter === 'ALL'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({factoryMovements.length})
            </button>
            <button
              onClick={() => setTypeFilter('MFG_OUT')}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
                typeFilter === 'MFG_OUT'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-rose-700'
              }`}
            >
              <span>خروج للمصنع</span>
              <span className="text-[10px] opacity-80">({stats.outCount})</span>
            </button>
            <button
              onClick={() => setTypeFilter('MFG_IN')}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1 ${
                typeFilter === 'MFG_IN'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-emerald-700'
              }`}
            >
              <span>وارد من المصنع</span>
              <span className="text-[10px] opacity-80">({stats.inCount})</span>
            </button>
          </div>

          {/* Period Filter Dropdown & CSV Export */}
          <div className="flex items-center gap-2">
            <select
              value={periodFilter}
              onChange={(e) => setPeriodFilter(e.target.value as PeriodFilter)}
              className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            >
              <option value="ALL">جميع الفترات</option>
              <option value="TODAY">اليوم (من 12:00 ص بتوقيت الرياض)</option>
              <option value="WEEK">هذا الأسبوع (الجمعة إلى الخميس)</option>
              <option value="MONTH">هذا الشهر (من 1 إلى نهاية الشهر)</option>
              <option value="CUSTOM">تاريخ مخصص...</option>
            </select>

            <button
              onClick={handleExportCSV}
              disabled={filteredMovements.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              <span>تصدير CSV</span>
            </button>

            <button
              onClick={() => setIsReportModalOpen(true)}
              disabled={filteredMovements.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="w-3.5 h-3.5 text-rose-600" />
              <span>تصدير PDF</span>
            </button>
          </div>
        </div>

        {/* Custom Date Range (if periodFilter === 'CUSTOM') */}
        {periodFilter === 'CUSTOM' && (
          <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap items-center gap-3 text-xs">
            <span className="font-bold text-slate-600">الفترة المخصصة:</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">من:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400">إلى:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white font-bold"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. Operations Log Table (سجل جميع العمليات) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base font-black text-slate-900">سجل عمليات المصنع</h2>
            <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-200 text-slate-700 font-bold">
              {filteredMovements.length} حركة
            </span>
          </div>

          <div className="text-xs text-slate-500 font-medium hidden sm:block">
            كل حركة مستقلة وموثقة برقم سند رسمي
          </div>
        </div>

        {filteredMovements.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-slate-100 text-slate-400 flex items-center justify-center">
              <Factory className="w-7 h-7" />
            </div>
            <h3 className="text-sm font-black text-slate-800">لا توجد حركات مطابقة للفلاتر</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              يمكنك تسجيل حركة جديدة بسهولة باستخدام زر «خروج للمصنع» أو «وارد من المصنع» أعلاه.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5 pr-5">رقم السند</th>
                    <th className="p-3.5">التاريخ والوقت</th>
                    <th className="p-3.5">نوع الحركة</th>
                    <th className="p-3.5">الصنف</th>
                    <th className="p-3.5 text-center">الكمية</th>
                    <th className="p-3.5 text-center">المعادل بالأساسية</th>
                    <th className="p-3.5">الملاحظة</th>
                    <th className="p-3.5 pl-5 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.map((m, idx) => {
                    const item = items.find((i) => i.id === m.itemId);
                    const unit = units.find((u) => u.id === m.unitId);
                    const baseUnit = units.find((u) => u.id === item?.baseUnitId);
                    const category = categories.find((c) => c.id === item?.categoryId);

                    const isOut =
                      m.type === 'MFG_OUT' ||
                      m.type === 'OUT' ||
                      m.type === 'PRODUCTION_DISPATCH' ||
                      (m.type as string) === 'خروج للمصنع' ||
                      (m.referenceNumber && m.referenceNumber.startsWith('MFG-OUT-'));

                    return (
                      <tr key={m.id ? `${m.id}_${idx}` : idx} className="hover:bg-slate-50/70 transition">

                        {/* Reference */}
                        <td className="p-3.5 pr-5 font-mono font-bold text-slate-900">
                          <button
                            onClick={() => setVoucherMovement(m)}
                            className="hover:underline text-indigo-700 hover:text-indigo-900"
                            title="عرض السند والطباعة"
                          >
                            {m.referenceNumber || m.id}
                          </button>
                        </td>

                        {/* Date */}
                        <td className="p-3.5 text-slate-600 font-medium whitespace-nowrap">
                          {new Date(m.date).toLocaleString('ar-SA', {
                            year: 'numeric',
                            month: 'numeric',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>

                        {/* Type Badge */}
                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-black ${
                              isOut
                                ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isOut ? (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            ) : (
                              <ArrowDownLeft className="w-3.5 h-3.5" />
                            )}
                            <span>{isOut ? 'خروج للمصنع' : 'وارد من المصنع'}</span>
                          </span>
                        </td>

                        {/* Item */}
                        <td className="p-3.5">
                          <div className="font-black text-slate-900">{item?.name || 'صنف غير معروف'}</div>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                            <span className="font-mono bg-slate-100 px-1 rounded">{item?.code || '-'}</span>
                            {category && <span>• {category.name}</span>}
                          </div>
                        </td>

                        {/* Quantity */}
                        <td className="p-3.5 text-center whitespace-nowrap">
                          <span
                            className={`font-black font-mono text-sm ${
                              isOut ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {isOut ? '-' : '+'}
                            {m.quantity} {unit?.name || 'وحدة'}
                          </span>
                        </td>

                        {/* Base Equivalent */}
                        <td className="p-3.5 text-center whitespace-nowrap font-mono font-bold text-slate-700">
                          {m.baseQuantity} {baseUnit?.name || 'وحدة'}
                        </td>

                        {/* Notes */}
                        <td className="p-3.5 text-slate-600 max-w-xs truncate">
                          {m.notes || <span className="text-slate-300">-</span>}
                        </td>

                        {/* Actions */}
                        <td className="p-3.5 pl-5 text-center whitespace-nowrap">
                          <button
                            onClick={() => setVoucherMovement(m)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition shadow-2xs"
                            title="طباعة السند الرسمي"
                          >
                            <Printer className="w-3.5 h-3.5 text-slate-600" />
                            <span>طباعة السند</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredMovements.map((m, idx) => {
                const item = items.find((i) => i.id === m.itemId);
                const unit = units.find((u) => u.id === m.unitId);
                const baseUnit = units.find((u) => u.id === item?.baseUnitId);

                const isOut =
                  m.type === 'MFG_OUT' ||
                  m.type === 'OUT' ||
                  m.type === 'PRODUCTION_DISPATCH' ||
                  (m.type as string) === 'خروج للمصنع' ||
                  (m.referenceNumber && m.referenceNumber.startsWith('MFG-OUT-'));

                return (
                  <div key={m.id ? `${m.id}_card_${idx}` : idx} className="p-4 space-y-3">

                    <div className="flex items-center justify-between">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black ${
                          isOut ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {isOut ? (
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        ) : (
                          <ArrowDownLeft className="w-3.5 h-3.5" />
                        )}
                        <span>{isOut ? 'خروج للمصنع' : 'وارد من المصنع'}</span>
                      </span>

                      <span className="font-mono text-xs font-bold text-slate-700">
                        {m.referenceNumber || m.id}
                      </span>
                    </div>

                    <div>
                      <div className="text-sm font-black text-slate-900">{item?.name || 'صنف'}</div>
                      <div className="text-xs text-slate-500 font-mono mt-0.5">{item?.code}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-slate-50 rounded-xl text-xs">
                      <div>
                        <div className="text-[10px] text-slate-400">الكمية المسجلة</div>
                        <div
                          className={`font-mono font-black ${
                            isOut ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {isOut ? '-' : '+'}
                          {m.quantity} {unit?.name || 'وحدة'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-slate-400">المعادل بالأساسية</div>
                        <div className="font-mono font-bold text-slate-800">
                          {m.baseQuantity} {baseUnit?.name || 'وحدة'}
                        </div>
                      </div>
                    </div>

                    {m.notes && (
                      <div className="text-xs text-slate-600 bg-amber-50/50 p-2 rounded-lg border border-amber-200/50">
                        <strong className="text-amber-900 ml-1">ملاحظة:</strong>
                        <span>{m.notes}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-400">
                        {new Date(m.date).toLocaleDateString('ar-SA')}
                      </span>
                      <button
                        onClick={() => setVoucherMovement(m)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-bold transition shadow-2xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>طباعة السند</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Movement Modal (خروج للمصنع أو وارد من المصنع) */}
      {modalType && (
        <FactoryMovementModal
          isOpen={true}
          type={modalType}
          onClose={() => setModalType(null)}
          onSuccess={(createdMovement) => {
            // Automatically prompt the printable voucher
            setVoucherMovement(createdMovement);
          }}
        />
      )}

      {/* Printable Voucher Modal */}
      {voucherMovement && (
        <FactoryVoucherModal
          isOpen={true}
          movement={voucherMovement}
          onClose={() => setVoucherMovement(null)}
        />
      )}

      {/* Universal Report Modal for PDF Export & Print */}
      <UniversalReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialSections={['production']}
        reportTitle="تقرير حركات الإنتاج والتصنيع (حسب التاريخ والفلاتر المحددة)"
        initialPeriod={periodFilter === 'TODAY' ? 'today' : periodFilter === 'WEEK' ? 'this_week' : periodFilter === 'MONTH' ? 'this_month' : periodFilter === 'CUSTOM' ? 'custom' : 'all'}
        customStartDate={customStartDate}
        customEndDate={customEndDate}
        extraParams={{ customData: filteredMovements }}
      />
    </div>
  );
};
