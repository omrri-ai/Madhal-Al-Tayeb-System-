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
import { Building2, Truck } from 'lucide-react';

interface MovementsViewProps {
  onOpenNewMovement: (type?: MovementType) => void;
  onOpenOutgoingDispatch?: () => void;
}

export const MovementsView: React.FC<MovementsViewProps> = ({
  onOpenNewMovement,
  onOpenOutgoingDispatch,
}) => {
  const { movements, items, units, categories, getItemStock, deleteMovement } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [itemFilter, setItemFilter] = useState<string>('ALL');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Editing movement modal state
  const [editingMovement, setEditingMovement] = useState<StockMovement | null>(null);

  // Voucher / Invoice printable modal state
  const [voucherMovement, setVoucherMovement] = useState<StockMovement | null>(null);

  // Delete target state
  const [deleteTarget, setDeleteTarget] = useState<StockMovement | null>(null);

  // Filtered movements
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const item = items.find((i) => i.id === m.itemId);
      const itemName = item?.name || '';
      const itemCode = item?.code || '';

      // Search match
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        itemName.toLowerCase().includes(query) ||
        itemCode.toLowerCase().includes(query) ||
        (m.referenceNumber && m.referenceNumber.toLowerCase().includes(query)) ||
        (m.notes && m.notes.toLowerCase().includes(query));

      // Type match
      const matchesType = typeFilter === 'ALL' || m.type === typeFilter;

      // Item match
      const matchesItem = itemFilter === 'ALL' || m.itemId === itemFilter;

      // Date match
      let matchesDate = true;
      if (startDate) {
        matchesDate = matchesDate && m.date >= startDate;
      }
      if (endDate) {
        // Include full end day
        matchesDate = matchesDate && m.date <= `${endDate}T23:59:59`;
      }

      return matchesSearch && matchesType && matchesItem && matchesDate;
    });
  }, [movements, items, searchQuery, typeFilter, itemFilter, startDate, endDate]);

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteMovement(deleteTarget.id, deleteTarget.notes || 'حذف الحركة المخزنية من سجل الحركات');
    setDeleteTarget(null);
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredMovements.length === 0) return;

    const headers = ['التاريخ', 'نوع الحركة', 'رمز الصنف', 'اسم الصنف', 'الكمية', 'الوحدة', 'المعادل بالوحدة الأساسية', 'رقم المرجع', 'الملاحظات'];
    const rows = filteredMovements.map((m) => {
      const item = items.find((i) => i.id === m.itemId);
      const unit = units.find((u) => u.id === m.unitId);
      const baseUnit = units.find((u) => u.id === item?.baseUnitId);
      return [
        new Date(m.date).toLocaleString('ar-SA'),
        m.type === 'IN' ? 'دخول / وارد' : 'خروج / صادر',
        item?.code || '',
        item?.name || '',
        m.quantity,
        unit?.name || '',
        `${m.baseQuantity} ${baseUnit?.name || ''}`,
        m.referenceNumber || '',
        m.notes || '',
      ];
    });

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...rows.map((e) => e.map((val) => `"${val}"`).join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `سجل_حركات_المخزون_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Search & Filter Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-4 no-print">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search bar */}
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

          {/* Quick Add Movements & Export Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              disabled={filteredMovements.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              title="تصدير إلى ملف CSV / Excel"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>تصدير CSV</span>
            </button>

            <button
              onClick={handlePrint}
              disabled={filteredMovements.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              title="طباعة تقرير الحركات أو حفظه كـ PDF"
            >
              <Printer className="w-4 h-4 text-slate-600" />
              <span>طباعة السجل (PDF)</span>
            </button>

            <button
              onClick={() => onOpenNewMovement('IN')}
              className="flex items-center gap-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>تسجيل وارد</span>
            </button>

            {onOpenOutgoingDispatch ? (
              <button
                onClick={onOpenOutgoingDispatch}
                className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer shadow-xs"
                title="تصدير شحنة متعددة الأصناف لفرع أو لعميل (سمسا، فاستيلو، أرامكس)"
              >
                <Truck className="w-4 h-4" />
                <span>قسم صادر (متعدد الأصناف)</span>
              </button>
            ) : (
              <button
                onClick={() => onOpenNewMovement('OUT')}
                className="flex items-center gap-1 px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>تسجيل صادر</span>
              </button>
            )}
          </div>
        </div>

        {/* Detailed Filters Row */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Movement Type Filter */}
          <div>
            <label className="block text-slate-500 mb-1 font-medium">نوع الحركة:</label>
            <div className="flex bg-slate-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => setTypeFilter('ALL')}
                className={`flex-1 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
                  typeFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                الكل
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('IN')}
                className={`flex-1 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
                  typeFilter === 'IN' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700 hover:text-emerald-900'
                }`}
              >
                وارد (+)
              </button>
              <button
                type="button"
                onClick={() => setTypeFilter('OUT')}
                className={`flex-1 py-1.5 rounded-md font-bold transition-colors cursor-pointer ${
                  typeFilter === 'OUT' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700 hover:text-rose-900'
                }`}
              >
                صادر (-)
              </button>
            </div>
          </div>

          {/* Item Filter */}
          <div>
            <label className="block text-slate-500 mb-1 font-medium">تصفية حسب الصنف:</label>
            <select
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white"
            >
              <option value="ALL">جميع الأصناف ({items.length})</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.code})
                </option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-slate-500 mb-1 font-medium">من تاريخ:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="block text-slate-500 mb-1 font-medium">إلى تاريخ:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-medium focus:bg-white"
            />
          </div>
        </div>
      </div>

      {/* Movements Table */}
      {filteredMovements.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-4">
            <ArrowLeftRight className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">
            {movements.length === 0 ? 'لا توجد حركات مخزنية مسجلة بعد' : 'لا توجد حركات تطابق التصفية'}
          </h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            {movements.length === 0
              ? 'سجل أول حركة دخول أو خروج لمتابعة حركة الأصناف وتحديث الأرصدة تلقائياً.'
              : 'جرب إعادة ضبط خيارات البحث أو التواريخ لعرض الحركات.'}
          </p>
          {movements.length === 0 ? (
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => onOpenNewMovement('IN')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer inline-flex items-center gap-1.5"
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>تسجيل أول وارد</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('ALL');
                setItemFilter('ALL');
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-2 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-50 cursor-pointer"
            >
              إلغاء التصفية
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">التاريخ والوقت</th>
                  <th className="py-3.5 px-4">نوع الحركة</th>
                  <th className="py-3.5 px-4">الصنف والرمز</th>
                  <th className="py-3.5 px-4">الكمية المسجلة</th>
                  <th className="py-3.5 px-4">المعادل بالوحدة الأساسية</th>
                  <th className="py-3.5 px-4">رقم المرجع / الإذن</th>
                  <th className="py-3.5 px-4">الملاحظات</th>
                  <th className="py-3.5 px-4 text-center no-print">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {filteredMovements.map((m) => {
                  const item = items.find((i) => i.id === m.itemId);
                  const unit = units.find((u) => u.id === m.unitId);
                  const baseUnit = units.find((u) => u.id === item?.baseUnitId);

                  return (
                    <tr key={m.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Date */}
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-600 whitespace-nowrap">
                        <div>{new Date(m.date).toLocaleDateString('ar-SA')}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(m.date).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3.5 px-4">
                        {m.type === 'IN' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full">
                            <ArrowDownLeft className="w-3.5 h-3.5" />
                            <span>دخول / وارد</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 border border-rose-200/80 px-2.5 py-1 rounded-full">
                            <ArrowUpRight className="w-3.5 h-3.5" />
                            <span>خروج / صادر</span>
                          </span>
                        )}
                      </td>

                      {/* Item */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-slate-900 block">
                          {item?.name || 'صنف غير معروف'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400 block">
                          {item?.code || '-'}
                        </span>
                      </td>

                      {/* Quantity & Unit */}
                      <td className="py-3.5 px-4 font-bold font-mono text-slate-900">
                        <span>{m.quantity.toLocaleString('ar-SA')}</span>{' '}
                        <span className="font-sans text-xs text-slate-600 font-medium">
                          {unit?.name || 'وحدة'}
                        </span>
                      </td>

                      {/* Base Quantity */}
                      <td className="py-3.5 px-4 text-xs font-mono">
                        <span className="font-bold text-slate-800">
                          {m.baseQuantity.toLocaleString('ar-SA')}
                        </span>{' '}
                        <span className="font-sans text-slate-500">{baseUnit?.name || 'وحدة'}</span>
                        {m.factorApplied > 1 && (
                          <span className="text-[10px] text-slate-400 block">
                            (معامل: {m.factorApplied})
                          </span>
                        )}
                      </td>

                      {/* Reference & Destination */}
                      <td className="py-3.5 px-4 text-xs font-mono text-slate-600">
                        {m.destinationType === 'BRANCH' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                              <Building2 className="w-3 h-3 text-blue-600" />
                              <span>{m.branchName || 'فرع'}</span>
                            </span>
                            {m.referenceNumber && (
                              <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                                #{m.referenceNumber}
                              </span>
                            )}
                          </div>
                        ) : m.destinationType === 'CUSTOMER' ? (
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                              <Truck className="w-3 h-3 text-purple-600" />
                              <span>{m.customerName} ({m.shippingCompany || 'شحن'})</span>
                            </span>
                            {m.shippingTrackingNumber ? (
                              <span className="block text-[10px] text-slate-500 font-mono mt-0.5">
                                تتبع: {m.shippingTrackingNumber}
                              </span>
                            ) : m.referenceNumber ? (
                              <span className="block text-[10px] text-slate-400 font-mono mt-0.5">
                                #{m.referenceNumber}
                              </span>
                            ) : null}
                          </div>
                        ) : m.referenceNumber ? (
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                            #{m.referenceNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* Notes */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 max-w-xs truncate">
                        {m.notes || '-'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center no-print">
                        <div className="flex items-center justify-center gap-1">
                          {/* Print Invoice / Voucher Button */}
                          <button
                            onClick={() => setVoucherMovement(m)}
                            className="p-1.5 text-slate-500 hover:text-emerald-700 rounded-lg hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="طباعة سند الحركة / الفاتورة (PDF)"
                          >
                            <Printer className="w-4 h-4 text-emerald-600" />
                          </button>
                          <button
                            onClick={() => setEditingMovement(m)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            title="تعديل الحركة"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(m)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف الحركة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Movement Voucher / Printable Invoice Modal */}
      {voucherMovement && (() => {
        const item = items.find((i) => i.id === voucherMovement.itemId) || null;
        const unit = units.find((u) => u.id === voucherMovement.unitId) || null;
        const baseUnit = units.find((u) => u.id === item?.baseUnitId) || null;
        const category = categories.find((c) => c.id === item?.categoryId) || null;
        const currentStock = item ? getItemStock(item.id) : 0;

        return (
          <MovementVoucherModal
            isOpen={!!voucherMovement}
            onClose={() => setVoucherMovement(null)}
            movement={voucherMovement}
            item={item}
            unit={unit}
            baseUnit={baseUnit}
            category={category}
            currentStock={currentStock}
          />
        );
      })()}

      {/* Edit Movement Modal */}
      {editingMovement && (
        <StockMovementModal
          isOpen={!!editingMovement}
          onClose={() => setEditingMovement(null)}
          editingMovement={editingMovement}
        />
      )}

      {/* Delete Movement Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="حذف الحركة المخزنية"
        message="هل أنت متأكد من رغبتك في حذف هذه الحركة؟ سيتم عكس أثرها على رصيد الصنف تلقائياً بعد التحقق من عدم التسبب في رصيد سالب."
        confirmLabel="حذف الحركة"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
