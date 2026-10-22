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

  const [searchQuery, setSearchQuery] = useState(initialSearchQuery || '');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>(initialType || 'ALL');
  const [branchFilter, setBranchFilter] = useState<string>(initialBranchId || 'ALL');
  const [itemFilter, setItemFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>(initialStartDate || '');
  const [endDate, setEndDate] = useState<string>(initialEndDate || '');

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

  // Precomputed Date Ranges & Counts for Quick Buttons
  const todayRange = useMemo(() => computeReportDateRange('today'), []);
  const yesterdayRange = useMemo(() => computeReportDateRange('yesterday'), []);
  const weekRange = useMemo(() => computeReportDateRange('this_week'), []);
  const monthRange = useMemo(() => computeReportDateRange('this_month'), []);

  const todayCount = useMemo(
    () => movements.filter((m) => isRecordInDateRange(m.date, todayRange)).length,
    [movements, todayRange]
  );
  const yesterdayCount = useMemo(
    () => movements.filter((m) => isRecordInDateRange(m.date, yesterdayRange)).length,
    [movements, yesterdayRange]
  );
  const weekCount = useMemo(
    () => movements.filter((m) => isRecordInDateRange(m.date, weekRange)).length,
    [movements, weekRange]
  );
  const monthCount = useMemo(
    () => movements.filter((m) => isRecordInDateRange(m.date, monthRange)).length,
    [movements, monthRange]
  );

  const filteredMovements = useMemo(() => {
    const list = movements.filter((m) => {
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

      const matchesType =
        typeFilter === 'ALL' ||
        (typeFilter === 'IN' ? isIncomingMovement(m.type) : isOutgoingMovement(m.type));

      return (
        matchesSearch &&
        matchesType &&
        (itemFilter === 'ALL' || m.itemId === itemFilter) &&
        (branchFilter === 'ALL' || m.branchId === branchFilter) &&
        (!startDate || m.date >= startDate) &&
        (!endDate || m.date <= `${endDate}T23:59:59`)
      );

    });

    // Sort descending by date & creation time (newest first)
    return list.sort((a, b) => {
      const timeA = new Date(a.createdAt || a.date || 0).getTime();
      const timeB = new Date(b.createdAt || b.date || 0).getTime();
      return timeB - timeA;
    });
  }, [movements, items, branches, searchQuery, typeFilter, branchFilter, itemFilter, startDate, endDate]);

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
        const timeMin = new Date(m.createdAt || m.date).toISOString().substring(0, 16);
        const dest = (m.destinationName || m.branchName || m.customerName || m.supplierName || '').trim().toLowerCase();
        if (dest) {
          key = `time_${timeMin}_dest_${dest}`;
        }
      }

      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return Object.values(groups);
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
      const dest = m.destinationName || m.branchName || m.customerName || m.supplierName || '-';
      return [new Date(m.date).toLocaleString('ar-SA'), m.type === 'IN' ? 'دخول / وارد' : 'خروج / صادر', item?.code || '', item?.name || '', m.quantity, unit?.name || '', `${m.baseQuantity} ${baseUnit?.name || ''}`, m.referenceNumber || 'توريد مخزني', dest, m.notes || ''];
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
              onClick={() => handleOpenReport('all', 'تقرير سجل حركات المخزون')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs"
              title="معاينة وطباعة وتصدير التقرير كـ PDF"
            >
              <Printer className="w-4 h-4 text-emerald-400" />
              <span>طباعة وتصدير التقرير</span>
            </button>
          </div>
        </div>

        {/* Quick Report Download & Print Strip */}
        <div className="pt-3 border-t border-slate-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
            <span className="p-1.5 bg-emerald-50 text-emerald-700 rounded-lg">
              <FileText className="w-4 h-4" />
            </span>
            <span>تقارير وتنزيل الحركات المباشرة (تنزيل PDF / طباعة فورية):</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 w-full md:w-auto">
            {/* Today */}
            <button
              type="button"
              onClick={() => handleOpenReport('today', 'تقرير حركات اليوم')}
              className="flex items-center justify-between sm:justify-center gap-2 px-3 py-2 bg-emerald-50 hover:bg-emerald-100/90 border border-emerald-200 text-emerald-950 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs group"
              title="فتح معاينة وتنزيل تقرير حركات اليوم"
            >
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                <span>حركات اليوم</span>
              </div>
              <span className="px-1.5 py-0.5 bg-emerald-200 text-emerald-900 rounded-md text-[10px] font-mono font-bold">
                {todayCount}
              </span>
            </button>

            {/* Yesterday */}
            <button
              type="button"
              onClick={() => handleOpenReport('yesterday', 'تقرير حركات أمس')}
              className="flex items-center justify-between sm:justify-center gap-2 px-3 py-2 bg-sky-50 hover:bg-sky-100/90 border border-sky-200 text-sky-950 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs group"
              title="فتح معاينة وتنزيل تقرير حركات أمس"
            >
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-sky-600" />
                <span>حركات أمس</span>
              </div>
              <span className="px-1.5 py-0.5 bg-sky-200 text-sky-900 rounded-md text-[10px] font-mono font-bold">
                {yesterdayCount}
              </span>
            </button>

            {/* Week */}
            <button
              type="button"
              onClick={() => handleOpenReport('this_week', 'تقرير حركات هذا الأسبوع')}
              className="flex items-center justify-between sm:justify-center gap-2 px-3 py-2 bg-indigo-50 hover:bg-indigo-100/90 border border-indigo-200 text-indigo-950 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs group"
              title="فتح معاينة وتنزيل تقرير حركات هذا الأسبوع"
            >
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>حركات الأسبوع</span>
              </div>
              <span className="px-1.5 py-0.5 bg-indigo-200 text-indigo-900 rounded-md text-[10px] font-mono font-bold">
                {weekCount}
              </span>
            </button>

            {/* Month */}
            <button
              type="button"
              onClick={() => handleOpenReport('this_month', 'تقرير حركات هذا الشهر')}
              className="flex items-center justify-between sm:justify-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100/90 border border-amber-200 text-amber-950 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs group"
              title="فتح معاينة وتنزيل تقرير حركات هذا الشهر"
            >
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
                <span>حركات الشهر</span>
              </div>
              <span className="px-1.5 py-0.5 bg-amber-200 text-amber-900 rounded-md text-[10px] font-mono font-bold">
                {monthCount}
              </span>
            </button>
          </div>
        </div>
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

                let orderBadgeText = 'أمر صرف مخزني';
                let orderBadgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
                if (isMfgOut) {
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
                      <td className="py-3.5 px-4 text-xs text-slate-600">
                        {new Date(first.createdAt || first.date).toLocaleString('ar-SA')}
                      </td>
                      <td className="py-3.5 px-4 text-xs font-bold font-mono">
                        {movementsGroup.length} صنف
                      </td>
                      <td className="py-3.5 px-4 text-xs font-medium text-slate-700">
                        {destinationDisplay}
                      </td>
                      <td className="py-3.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          {!isFirstIn && (
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
                                      m.type === 'MFG_OUT'
                                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                        : m.type === 'MFG_IN'
                                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                        : itemIsIn
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-rose-100 text-rose-800'
                                    }`}>
                                      {m.type === 'MFG_OUT'
                                        ? 'أمر صرف للمصنع'
                                        : m.type === 'MFG_IN'
                                        ? 'وارد من المصنع'
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
      {editingDispatchVoucher && (
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
          customData: reportInitialPeriod === 'all' && (searchQuery || typeFilter !== 'ALL' || branchFilter !== 'ALL' || itemFilter !== 'ALL' || startDate || endDate) ? filteredMovements : undefined,
        }}
      />
    </div>
  );
};
