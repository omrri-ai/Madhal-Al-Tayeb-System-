import React, { useState, useMemo } from 'react';
import {
  ArrowLeftRight,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Calendar,
  Edit,
  Trash2,
  FileSpreadsheet,
  Printer,
  Download,
  AlertCircle,
  Plus,
  FileText,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';
import { MovementType, StockMovement } from '../../types/inventory';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { StockMovementModal } from './StockMovementModal';
import { MovementVoucherModal } from './MovementVoucherModal';
import { OutgoingDispatchModal } from './OutgoingDispatchModal';
import { Building2, Truck, Edit2 } from 'lucide-react';
import { isIncomingMovement, isOutgoingMovement } from '../../utils/arabicSearch';
import { UniversalReportModal } from '../reports/UniversalReportModal';
import {
  ReportPeriod,
  computeReportDateRange,
  isRecordInDateRange,
} from '../../utils/reportDateFilters';


interface MovementsViewProps {
  onOpenNewMovement: (type?: MovementType) => void;
  onOpenOutgoingDispatch?: () => void;
  initialType?: 'ALL' | 'IN' | 'OUT';
  initialBranchId?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  initialSearchQuery?: string;
  initialMovementId?: string;
  returnToReports?: () => void;
}

export const MovementsView: React.FC<MovementsViewProps> = ({
  onOpenNewMovement,
  onOpenOutgoingDispatch,
  initialType = 'ALL',
  initialBranchId = 'ALL',
  initialStartDate = '',
  initialEndDate = '',
  initialSearchQuery = '',
  initialMovementId,
  returnToReports,
}) => {
  const { movements, items, units, categories, branches, getItemStock, deleteMovement } = useInventory();
  const { isAdmin } = useAuth();

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>(initialType || 'ALL');
  const [branchFilter, setBranchFilter] = useState<string>(initialBranchId || 'ALL');
  const [itemFilter, setItemFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>(initialStartDate || '');
  const [endDate, setEndDate] = useState<string>(initialEndDate || '');

  // Quick period filter state ('ALL' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month')
  const [periodFilter, setPeriodFilter] = useState<'ALL' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month'>('ALL');

  const activeDateRange = useMemo(() => {
    if (periodFilter === 'ALL') return null;
    return computeReportDateRange(periodFilter);
  }, [periodFilter]);

  const [editingMovement, setEditingMovement] = useState<StockMovement | null>(null);
  const [voucherMovement, setVoucherMovement] = useState<StockMovement | null>(null);

  React.useEffect(() => {
    if (initialMovementId) {
      const match = movements.find((m) => m.id === initialMovementId);
      if (match) setVoucherMovement(match);
    }
  }, [initialMovementId, movements]);

  const [deleteTarget, setDeleteTarget] = useState<StockMovement | null>(null);
  const [editingDispatchVoucher, setEditingDispatchVoucher] = useState<string | null>(null);

  // Quick Movements Report Modal State
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportInitialPeriod, setReportInitialPeriod] = useState<ReportPeriod>('today');
  const [reportTitle, setReportTitle] = useState('تقرير حركات اليوم');

  const handleOpenReport = (selectedPeriod: ReportPeriod, customTitle: string) => {
    setReportInitialPeriod(selectedPeriod);
    setReportTitle(customTitle);
    setIsReportModalOpen(true);
  };

  // Helper to identify silent/hidden adjustment movements that shouldn't appear in the movements table
  const isSilentMovement = (m: StockMovement) => {
    // Hide all adjustments from viewer mode as requested ("ما تظهر للمشاهد")
    if (!isAdmin && m.type === 'ADJUSTMENT') return true;
    if (m.isHidden || m.isSilent) return true;
    const notes = m.notes || '';
    if (
      notes.includes('تسوية جردية صامتة') ||
      notes.includes('تعديل صامت') ||
      notes.includes('صامتة') ||
      notes.includes('تعديل الرصيد الصامت')
    ) {
      return true;
    }
    return false;
  };

  // Visible movements: strictly excluding silent adjustments (and all adjustments for viewer)
  const visibleMovements = useMemo(() => {
    return movements.filter((m) => !isSilentMovement(m));
  }, [movements, isAdmin]);

  // Precomputed Date Ranges & Counts for Quick Buttons
  const todayRange = useMemo(() => computeReportDateRange('today'), []);
  const yesterdayRange = useMemo(() => computeReportDateRange('yesterday'), []);
  const weekRange = useMemo(() => computeReportDateRange('this_week'), []);
  const lastWeekRange = useMemo(() => computeReportDateRange('last_week'), []);
  const monthRange = useMemo(() => computeReportDateRange('this_month'), []);
  const lastMonthRange = useMemo(() => computeReportDateRange('last_month'), []);

  const todayCount = useMemo(
    () => visibleMovements.filter((m) => isRecordInDateRange(m.date, todayRange)).length,
    [visibleMovements, todayRange]
  );
  const yesterdayCount = useMemo(
    () => visibleMovements.filter((m) => isRecordInDateRange(m.date, yesterdayRange)).length,
    [visibleMovements, yesterdayRange]
  );
  const weekCount = useMemo(
    () => visibleMovements.filter((m) => isRecordInDateRange(m.date, weekRange)).length,
    [visibleMovements, weekRange]
  );
  const lastWeekCount = useMemo(
    () => visibleMovements.filter((m) => isRecordInDateRange(m.date, lastWeekRange)).length,
    [visibleMovements, lastWeekRange]
  );
  const monthCount = useMemo(
    () => visibleMovements.filter((m) => isRecordInDateRange(m.date, monthRange)).length,
    [visibleMovements, monthRange]
  );
  const lastMonthCount = useMemo(
    () => visibleMovements.filter((m) => isRecordInDateRange(m.date, lastMonthRange)).length,
    [visibleMovements, lastMonthRange]
  );

  // Helper to reliably extract timestamp for chronological sorting
  const getMovementTimestamp = (m: StockMovement): number => {
    if (m.date) {
      const t = new Date(m.date).getTime();
      if (!isNaN(t)) return t;
    }
    if (m.createdAt) {
      const t = new Date(m.createdAt).getTime();
      if (!isNaN(t)) return t;
    }
    return 0;
  };

  const filteredMovements = useMemo(() => {
    const list = visibleMovements.filter((m) => {
      // 1. Quick Period Filter check using Riyadh standardized ranges
      if (activeDateRange) {
        if (!isRecordInDateRange(m.date, activeDateRange)) {
          return false;
        }
      }

      // 2. Custom date inputs if provided
      if (startDate && m.date < startDate) return false;
      if (endDate && m.date > `${endDate}T23:59:59`) return false;

      // 3. Search query
      const item = items.find((i) => i.id === m.itemId);
      const query = searchQuery.toLowerCase().trim();
      const destinationStr = `${m.destinationName || ''} ${m.branchName || ''} ${m.customerName || ''} ${m.destinationContactName || ''} ${m.supplierName || ''} ${m.shippingCompany || ''} ${m.customShippingCompany || ''}`.toLowerCase();
      const matchesSearch =
        !query ||
        (item?.name || '').toLowerCase().includes(query) ||
        (item?.code || '').toLowerCase().includes(query) ||
        (m.referenceNumber && m.referenceNumber.toLowerCase().includes(query)) ||
        destinationStr.includes(query) ||
        (m.notes && m.notes.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // 4. Type filter
      if (typeFilter !== 'ALL') {
        const matchesType =
          typeFilter === 'IN'
            ? isIncomingMovement(m.type) || (m.type === 'ADJUSTMENT' && (m.baseQuantity ?? m.quantity) > 0)
            : isOutgoingMovement(m.type) || (m.type === 'ADJUSTMENT' && (m.baseQuantity ?? m.quantity) < 0);
        if (!matchesType) return false;
      }

      // 5. Item & Branch filters
      if (itemFilter !== 'ALL' && m.itemId !== itemFilter) return false;
      if (branchFilter !== 'ALL' && m.branchId !== branchFilter) return false;

      return true;
    });

    // Sort strictly descending by date from newest to oldest (الأحدث أولاً)
    return list.sort((a, b) => getMovementTimestamp(b) - getMovementTimestamp(a));
  }, [visibleMovements, items, activeDateRange, searchQuery, typeFilter, branchFilter, itemFilter, startDate, endDate]);

  const groupedMovements = useMemo(() => {
    const groups: Record<string, StockMovement[]> = {};
    filteredMovements.forEach((m) => {
      const cleanRef = (m.referenceNumber || '').trim().toLowerCase();
      const cleanBatch = (m.batchId || '').trim().toLowerCase();
      const cleanNotes = (m.notes || '').trim().toLowerCase();
      let key = `mov_${m.id}`;
      if (cleanRef) {
        key = `ref_${cleanRef}`;
      } else if (cleanBatch) {
        key = `batch_${cleanBatch}`;
      } else if (cleanNotes && cleanNotes.length < 40) {
        key = `notes_${cleanNotes}`;
      } else {
        const timeMin = new Date(m.date || m.createdAt).toISOString().substring(0, 16);
        const dest = (m.destinationName || m.branchName || m.customerName || m.supplierName || '').trim().toLowerCase();
        if (dest) {
          key = `time_${timeMin}_dest_${dest}`;
        }
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });

    // Sort items within each voucher group newest first
    const groupList = Object.values(groups).map((group) => {
      return group.sort((a, b) => getMovementTimestamp(b) - getMovementTimestamp(a));
    });

    // Sort all voucher groups descending by the latest movement date (الأحدث أولاً)
    return groupList.sort((groupA, groupB) => {
      const latestA = Math.max(...groupA.map(getMovementTimestamp));
      const latestB = Math.max(...groupB.map(getMovementTimestamp));
      return latestB - latestA;
    });
  }, [filteredMovements]);

  const [expandedVouchers, setExpandedVouchers] = useState<Record<string, boolean>>({});

  const toggleExpand = (key: string) => {
    setExpandedVouchers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMovement(deleteTarget.id, deleteTarget.notes || 'حذف الحركة المخزنية من سجل الحركات');
    setDeleteTarget(null);
  };

  const handleExportCSV = () => {
    if (filteredMovements.length === 0) return;
    const headers = ['التاريخ', 'نوع الحركة', 'رمز الصنف', 'اسم الصنف', 'الكمية', 'الوحدة', 'المعادل بالوحدة الأساسية', 'رقم المرجع', 'الوجهة / الجهة', 'الملاحظات'];
    const rows = filteredMovements.map((m) => {
      const item = items.find((i) => i.id === m.itemId);
      const unit = units.find((u) => u.id === m.unitId);
      const baseUnit = units.find((u) => u.id === item?.baseUnitId);
      const isMIn = isIncomingMovement(m.type) || (m.type === 'ADJUSTMENT' && (m.baseQuantity ?? m.quantity) > 0);
      const typeStr = m.type === 'MFG_IN' ? 'وارد من المصنع' : m.type === 'MFG_OUT' ? 'صرف للمصنع' : m.type === 'ADJUSTMENT' ? 'تسوية جردية' : isMIn ? 'دخول / وارد' : 'خروج / صادر';
      const dest = m.destinationName || m.branchName || m.customerName || m.supplierName || '-';
      return [new Date(m.date).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' }), typeStr, item?.code || '', item?.name || '', m.quantity, unit?.name || '', `${m.baseQuantity} ${baseUnit?.name || ''}`, m.referenceNumber || (isMIn ? 'توريد مخزني' : 'صرف مخزني'), dest, m.notes || ''];
    });
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `سجل_حركات_المخزون_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => window.print();

  return (
    <div className="space-y-6">
      {/* Search & Filter Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 no-print">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث برقم الفاتورة، اسم الصنف، رمزه، أو الملاحظات..."
              className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3.5 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              title="تصدير السجل كملف Excel / CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تصدير CSV</span>
            </button>
            <button
              onClick={() =>
                handleOpenReport(
                  periodFilter === 'ALL' ? 'all' : periodFilter,
                  periodFilter === 'ALL'
                    ? 'تقرير سجل حركات المخزون'
                    : `تقرير ${activeDateRange?.label || 'الحركات'}`
                )
              }
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              title="معاينة وطباعة وتصدير التقرير كـ PDF"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>
                {periodFilter === 'ALL' ? 'طباعة وتصدير التقرير' : `طباعة تقرير ${activeDateRange?.label || ''}`}
              </span>
            </button>
          </div>
        </div>

        {/* Quick Period Filter & Action Strip */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <Calendar className="w-4 h-4" />
            </span>
            <span>تصفية الحركات بالفترة الزمنية (توقيت الرياض):</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
            {/* All */}
            <button
              type="button"
              onClick={() => setPeriodFilter('ALL')}
              className={`flex items-center justify-between sm:justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                periodFilter === 'ALL'
                  ? 'bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
              }`}
              title="عرض كافة الحركات دون تقييد زمني"
            >
              <span>جميع الحركات</span>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                periodFilter === 'ALL' ? 'bg-slate-800 text-slate-100' : 'bg-slate-200 text-slate-800'
              }`}>
                {visibleMovements.length}
              </span>
            </button>

            {/* Today */}
            <button
              type="button"
              onClick={() => setPeriodFilter((prev) => (prev === 'today' ? 'ALL' : 'today'))}
              className={`flex items-center justify-between sm:justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                periodFilter === 'today'
                  ? 'bg-emerald-600 text-white border-emerald-600 ring-2 ring-emerald-600/30'
                  : 'bg-emerald-50 hover:bg-emerald-100/90 border-emerald-200 text-emerald-950'
              }`}
              title="تصفية الجدول لعرض حركات اليوم فقط (من 12:00 ص بتوقيت الرياض)"
            >
              <div className="flex items-center gap-1.5">
                <Calendar className={`w-3.5 h-3.5 ${periodFilter === 'today' ? 'text-white' : 'text-emerald-600'}`} />
                <span>حركات اليوم</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                periodFilter === 'today' ? 'bg-emerald-700 text-white' : 'bg-emerald-200 text-emerald-900'
              }`}>
                {todayCount}
              </span>
            </button>

            {/* Yesterday */}
            <button
              type="button"
              onClick={() => setPeriodFilter((prev) => (prev === 'yesterday' ? 'ALL' : 'yesterday'))}
              className={`flex items-center justify-between sm:justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                periodFilter === 'yesterday'
                  ? 'bg-sky-600 text-white border-sky-600 ring-2 ring-sky-600/30'
                  : 'bg-sky-50 hover:bg-sky-100/90 border-sky-200 text-sky-950'
              }`}
              title="تصفية الجدول لعرض حركات أمس فقط"
            >
              <div className="flex items-center gap-1.5">
                <Calendar className={`w-3.5 h-3.5 ${periodFilter === 'yesterday' ? 'text-white' : 'text-sky-600'}`} />
                <span>حركات أمس</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                periodFilter === 'yesterday' ? 'bg-sky-700 text-white' : 'bg-sky-200 text-sky-900'
              }`}>
                {yesterdayCount}
              </span>
            </button>

            {/* This Week */}
            <button
              type="button"
              onClick={() => setPeriodFilter((prev) => (prev === 'this_week' ? 'ALL' : 'this_week'))}
              className={`flex items-center justify-between sm:justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                periodFilter === 'this_week'
                  ? 'bg-indigo-600 text-white border-indigo-600 ring-2 ring-indigo-600/30'
                  : 'bg-indigo-50 hover:bg-indigo-100/90 border-indigo-200 text-indigo-950'
              }`}
              title="تصفية الجدول لعرض حركات هذا الأسبوع الحالي (من الجمعة 12:00 ص إلى نهاية الخميس 11:59 م)"
            >
              <div className="flex items-center gap-1.5">
                <Calendar className={`w-3.5 h-3.5 ${periodFilter === 'this_week' ? 'text-white' : 'text-indigo-600'}`} />
                <span>هذا الأسبوع</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                periodFilter === 'this_week' ? 'bg-indigo-700 text-white' : 'bg-indigo-200 text-indigo-900'
              }`}>
                {weekCount}
              </span>
            </button>

            {/* Last Week (الأسبوع الماضي / اللي فات) */}
            <button
              type="button"
              onClick={() => setPeriodFilter((prev) => (prev === 'last_week' ? 'ALL' : 'last_week'))}
              className={`flex items-center justify-between sm:justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                periodFilter === 'last_week'
                  ? 'bg-purple-600 text-white border-purple-600 ring-2 ring-purple-600/30'
                  : 'bg-purple-50 hover:bg-purple-100/90 border-purple-200 text-purple-950'
              }`}
              title="تصفية الجدول لعرض حركات الأسبوع الماضي (اللي فات) (من الجمعة السابقة 12:00 ص إلى نهاية الخميس السابق 11:59 م)"
            >
              <div className="flex items-center gap-1.5">
                <Calendar className={`w-3.5 h-3.5 ${periodFilter === 'last_week' ? 'text-white' : 'text-purple-600'}`} />
                <span>الأسبوع الماضي (اللي فات)</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                periodFilter === 'last_week' ? 'bg-purple-700 text-white' : 'bg-purple-200 text-purple-900'
              }`}>
                {lastWeekCount}
              </span>
            </button>

            {/* This Month */}
            <button
              type="button"
              onClick={() => setPeriodFilter((prev) => (prev === 'this_month' ? 'ALL' : 'this_month'))}
              className={`flex items-center justify-between sm:justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                periodFilter === 'this_month'
                  ? 'bg-amber-600 text-white border-amber-600 ring-2 ring-amber-600/30'
                  : 'bg-amber-50 hover:bg-amber-100/90 border-amber-200 text-amber-950'
              }`}
              title="تصفية الجدول لعرض حركات هذا الشهر (من يوم 1 إلى نهاية الشهر)"
            >
              <div className="flex items-center gap-1.5">
                <Calendar className={`w-3.5 h-3.5 ${periodFilter === 'this_month' ? 'text-white' : 'text-amber-600'}`} />
                <span>هذا الشهر</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                periodFilter === 'this_month' ? 'bg-amber-700 text-white' : 'bg-amber-200 text-amber-900'
              }`}>
                {monthCount}
              </span>
            </button>

            {/* Last Month */}
            <button
              type="button"
              onClick={() => setPeriodFilter((prev) => (prev === 'last_month' ? 'ALL' : 'last_month'))}
              className={`flex items-center justify-between sm:justify-center gap-1.5 px-3 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                periodFilter === 'last_month'
                  ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-600/30'
                  : 'bg-rose-50 hover:bg-rose-100/90 border-rose-200 text-rose-950'
              }`}
              title="تصفية الجدول لعرض حركات الشهر الماضي بالكامل"
            >
              <div className="flex items-center gap-1.5">
                <Calendar className={`w-3.5 h-3.5 ${periodFilter === 'last_month' ? 'text-white' : 'text-rose-600'}`} />
                <span>الشهر الماضي</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold ${
                periodFilter === 'last_month' ? 'bg-rose-700 text-white' : 'bg-rose-200 text-rose-900'
              }`}>
                {lastMonthCount}
              </span>
            </button>
          </div>
        </div>

        {/* Active Filter Notice Bar with One-Click PDF Print Button */}
        {periodFilter !== 'ALL' && activeDateRange && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-150">
            <div className="flex items-center gap-2 text-emerald-950 font-bold flex-wrap">
              <span className="p-1.5 bg-emerald-200 text-emerald-900 rounded-lg">
                <Filter className="w-4 h-4" />
              </span>
              <span>يتم الآن عرض: {activeDateRange.label} فقط</span>
              <span className="text-emerald-700 font-normal">({activeDateRange.inclusiveNote})</span>
              <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full font-mono font-bold text-[11px]">
                {filteredMovements.length} حركة مطابقة
              </span>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => handleOpenReport(periodFilter, `تقرير ${activeDateRange.label}`)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg transition-colors cursor-pointer shadow-xs text-xs"
                title="معاينة وطباعة تقرير هذه الفترة كـ PDF"
              >
                <Printer className="w-3.5 h-3.5 text-emerald-200" />
                <span>معاينة وطباعة تقرير هذه الفترة</span>
              </button>
              <button
                type="button"
                onClick={() => setPeriodFilter('ALL')}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-lg border border-slate-200 transition-colors cursor-pointer text-xs"
              >
                إلغاء التصفية (عرض الكل)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Movements Table */}
      {groupedMovements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">لا توجد حركات مطابقة للبحث</div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-4 w-10"></th>
                <th className="py-3.5 px-4">رقم السند / المرجع</th>
                <th className="py-3.5 px-4">التاريخ والوقت</th>
                <th className="py-3.5 px-4">عدد الأصناف</th>
                <th className="py-3.5 px-4">الجهة / الوجهة</th>
                <th className="py-3.5 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-800">
              {groupedMovements.map((movementsGroup) => {
                const first = movementsGroup[0];
                const refKey = first.referenceNumber || first.batchId || `ref-${first.id}`;
                const isExpanded = expandedVouchers[refKey];
                const isFirstIn = isIncomingMovement(first.type);
                const isMfgOut =
                  first.type === 'MFG_OUT' ||
                  (first.type as string) === 'خروج للمصنع' ||
                  (first.referenceNumber && first.referenceNumber.startsWith('MFG-OUT-')) ||
                  ((first.destinationName || '').includes('مصنع') && !isFirstIn);
                const isMfgIn =
                  first.type === 'MFG_IN' ||
                  (first.type as string) === 'وارد من المصنع' ||
                  (first.referenceNumber && first.referenceNumber.startsWith('MFG-IN-')) ||
                  ((first.destinationName || '').includes('مصنع') && isFirstIn);
                const isAdjustment = first.type === 'ADJUSTMENT' || (first.notes || '').includes('تسوية');
                const isReturn = (first.type as string) === 'RETURN_IN' || (first.type as string) === 'RETURN_OUT' || (first.notes || '').includes('مرتجع');
                const isDamaged =
                  first.type === 'DAMAGED' ||
                  (first.type as string) === 'تالف' ||
                  (first.destinationType === 'DAMAGED' && !isFirstIn);
                const isDamagedRecovery =
                  first.type === 'DAMAGED_RECOVERY' ||
                  (first.type as string) === 'راجع من التالف' ||
                  (first.referenceNumber && first.referenceNumber.startsWith('REC-DMG-')) ||
                  ((first.notes || '').includes('راجع من التالف') && isFirstIn);

                let orderBadgeText = 'أمر صرف مخزني';
                let orderBadgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
                if (isDamagedRecovery) {
                  orderBadgeText = 'راجع من التالف (استرداد)';
                  orderBadgeStyle = 'bg-teal-100 text-teal-800 border-teal-300 font-bold';
                } else if (isDamaged) {
                  orderBadgeText = 'إتلاف مخزني';
                  orderBadgeStyle = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
                } else if (isMfgOut) {
                  orderBadgeText = 'أمر صرف للمصنع';
                  orderBadgeStyle = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
                } else if (isMfgIn) {
                  orderBadgeText = 'وارد من المصنع';
                  orderBadgeStyle = 'bg-emerald-100 text-emerald-800 border-emerald-300 font-bold';
                } else if (isAdjustment) {
                  orderBadgeText = 'تسوية جردية';
                  orderBadgeStyle = 'bg-amber-50 text-amber-800 border-amber-200 font-bold';
                } else if (isReturn) {
                  orderBadgeText = isFirstIn ? 'مرتجع وارد' : 'مرتجع صادر';
                  orderBadgeStyle = 'bg-sky-50 text-sky-800 border-sky-200 font-bold';
                } else if (isFirstIn) {
                  orderBadgeText = 'توريد مخزني';
                  orderBadgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                }

                const displayRef = first.referenceNumber || orderBadgeText;
                const destinationDisplay = first.destinationName || first.branchName || first.customerName || first.supplierName || 'مستودع مدهال الطيب الرئيسي';

                return (
                  <React.Fragment key={refKey}>
                    <tr 
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => toggleExpand(refKey)}
                    >
                      <td className="py-3.5 px-4">
                        <button type="button" className="p-1 cursor-pointer text-slate-500 font-bold">
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-bold font-mono text-slate-900">
                        <span className="inline-flex items-center gap-1.5 flex-wrap">
                          <span className={`w-2 h-2 rounded-full ${isFirstIn ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          <span>{displayRef}</span>
                          <span className={`px-2 py-0.5 rounded text-[10px] border shadow-2xs ${orderBadgeStyle}`}>
                            {orderBadgeText}
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-mono">
                        {new Date(first.date || first.createdAt).toLocaleString('ar-SA', { timeZone: 'Asia/Riyadh' })}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold font-mono">
                        {movementsGroup.length} صنف
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                        {destinationDisplay}
                      </td>
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {isAdmin && !isFirstIn && (
                            <button
                              onClick={() => setEditingDispatchVoucher(first.batchId || first.referenceNumber || first.id)}
                              className="p-1.5 text-slate-500 hover:text-amber-700 cursor-pointer rounded-lg hover:bg-amber-50 transition-colors"
                              title="تعديل السند المعتمد وإعادة احتساب المخزون"
                            >
                              <Edit2 className="w-4 h-4 text-amber-600" />
                            </button>
                          )}
                          <button 
                            onClick={() => setVoucherMovement(first)} 
                            className="p-1.5 text-slate-500 hover:text-emerald-700 cursor-pointer rounded-lg hover:bg-emerald-50 transition-colors"
                            title="معاينة وطباعة السند"
                          >
                            <Printer className="w-4 h-4 text-emerald-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={6} className="p-4 bg-slate-50/80">
                          <div className="space-y-1.5">
                            <div className="text-xs font-bold text-slate-500 mb-2">تفاصيل الأصناف في هذا السند:</div>
                            {movementsGroup.map((m, idx) => {
                              const itm = items.find(i => i.id === m.itemId);
                              const itmName = itm?.name || m.itemName || (m.notes && m.notes.length < 30 ? m.notes : 'صنف مخزني');
                              const itmCode = itm?.code || m.itemCode || '-';
                              const unt = units.find(u => u.id === m.unitId);
                              const untName = unt?.name || m.unitName || 'وحدة';
                              const itemIsIn = isIncomingMovement(m.type);
                              const qty = typeof m.quantity === 'number' && !isNaN(m.quantity) ? m.quantity : Number(m.quantity) || 0;

                              return (
                                <div key={m.id ? `${m.id}_${idx}` : idx} className="flex items-center justify-between border border-slate-200/80 p-2.5 bg-white rounded-xl shadow-2xs">
                                  <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      m.type === 'DAMAGED_RECOVERY' || (m.notes || '').includes('راجع من التالف')
                                        ? 'bg-teal-100 text-teal-800 border border-teal-200'
                                        : m.type === 'DAMAGED'
                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                        : m.type === 'MFG_OUT'
                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                        : m.type === 'MFG_IN'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : m.type === 'ADJUSTMENT'
                                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                        : itemIsIn
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {m.type === 'DAMAGED_RECOVERY' || (m.notes || '').includes('راجع من التالف')
                                        ? 'راجع من التالف (+)'
                                        : m.type === 'DAMAGED'
                                        ? 'تالف (-)'
                                        : m.type === 'MFG_OUT'
                                        ? 'أمر صرف للمصنع'
                                        : m.type === 'MFG_IN'
                                        ? 'وارد من المصنع'
                                        : m.type === 'ADJUSTMENT'
                                        ? ((m.baseQuantity ?? m.quantity) >= 0 ? 'تسوية وارد (+)' : 'تسوية صادر (-)')
                                        : itemIsIn
                                        ? 'وارد'
                                        : 'صادر'}
                                    </span>
                                    <span className="font-bold text-slate-900 text-xs">{itmName}</span>
                                    <span className="text-[11px] font-mono text-slate-400">({itmCode})</span>
                                  </div>

                                  <div className="font-mono text-xs font-bold text-slate-800">
                                    {qty} {untName}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Modals remain here */}
      {voucherMovement && (
        <MovementVoucherModal
            isOpen={!!voucherMovement}
            onClose={() => setVoucherMovement(null)}
            movement={voucherMovement}
            item={items.find(i => i.id === voucherMovement.itemId) || null}
            unit={units.find(u => u.id === voucherMovement.unitId) || null}
            baseUnit={units.find(u => u.id === items.find(i => i.id === voucherMovement.itemId)?.baseUnitId) || null}
            category={categories.find(c => c.id === items.find(i => i.id === voucherMovement.itemId)?.categoryId) || null}
            currentStock={getItemStock(voucherMovement.itemId)}
        />
      )}

      {/* Edit Approved Outgoing Dispatch Voucher Modal */}
      {isAdmin && editingDispatchVoucher && (
        <OutgoingDispatchModal
          isOpen={Boolean(editingDispatchVoucher)}
          editVoucherNoOrBatch={editingDispatchVoucher}
          onClose={() => setEditingDispatchVoucher(null)}
        />
      )}

      {/* Universal Report Modal with PDF Export and Direct Print */}
      <UniversalReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        initialSections={['movements']}
        reportTitle={reportTitle}
        initialPeriod={reportInitialPeriod}
        extraParams={{
          searchQuery,
          type: typeFilter === 'ALL' ? undefined : typeFilter,
          branchId: branchFilter === 'ALL' ? undefined : branchFilter,
          customData: filteredMovements,
        }}
      />
    </div>
  );
};
