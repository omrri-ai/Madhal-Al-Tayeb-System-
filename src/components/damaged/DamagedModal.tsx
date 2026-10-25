import React, { useState, useMemo } from 'react';
import {
  X,
  AlertTriangle,
  Plus,
  Trash2,
  ShieldAlert,
  Package,
  Search,
  ChevronDown,
  CheckCircle2,
  Boxes,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { DamagedReason } from '../../types/inventory';
import { canWithdraw } from '../../utils/stockRules';
import { ItemPickerBottomSheet } from '../common/ItemPickerBottomSheet';

interface DamagedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const REASONS: DamagedReason[] = [
  'تلف تخزين',
  'انتهاء صلاحية',
  'كسر / تلف عرضي',
  'عيب مصنعي',
  'أخرى',
];

interface DamagedItemRow {
  rowId: string;
  itemId: string;
  unitId: string;
  quantity: number | '';
  notes: string;
}

export const DamagedModal: React.FC<DamagedModalProps> = ({ isOpen, onClose }) => {
  const { items, units, categories, getItemStock, addMultiDamagedRecords, showToast } =
    useInventory();

  const [generalReason, setGeneralReason] = useState<DamagedReason | string>('تلف تخزين');
  const [generalNotes, setGeneralNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 16));
  const [rows, setRows] = useState<DamagedItemRow[]>([
    { rowId: 'row_1', itemId: '', unitId: '', quantity: '', notes: '' },
  ]);

  const [activePickerRowId, setActivePickerRowId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Unified inventory items (all active, non-archived items)
  const availableItems = useMemo(() => {
    return items.filter((i) => !i.isArchived && !i.isDeleted);
  }, [items]);

  // Add another item row
  const handleAddRow = () => {
    const nextItem = availableItems.find((i) => !rows.some((r) => r.itemId === i.id)) || availableItems[0];
    const newId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    setRows((prev) => [
      ...prev,
      {
        rowId: newId,
        itemId: nextItem ? nextItem.id : '',
        unitId: nextItem ? nextItem.baseUnitId : '',
        quantity: '',
        notes: '',
      },
    ]);
  };

  // Remove a row
  const handleRemoveRow = (rowId: string) => {
    if (rows.length === 1) {
      showToast('يجب أن يحتوي السند على صنف واحد على الأقل', 'error');
      return;
    }
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  // Update a row field
  const handleRowChange = (rowId: string, field: keyof DamagedItemRow, value: any) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.rowId !== rowId) return row;

        if (field === 'itemId') {
          const selectedItm = items.find((i) => i.id === value);
          return {
            ...row,
            itemId: value,
            unitId: selectedItm ? selectedItm.baseUnitId : '',
            quantity: '',
          };
        }

        return { ...row, [field]: value };
      })
    );
    setErrorMsg(null);
  };

  // Helper for available units for a row's item
  const getRowUnits = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return [];
    const list: { id: string; name: string; factor: number; label: string }[] = [];
    const baseU = units.find((u) => u.id === item.baseUnitId);
    if (baseU) {
      list.push({
        id: baseU.id,
        name: baseU.name,
        factor: 1,
        label: `${baseU.name} (الوحدة الأساسية)`,
      });
    }
    for (const conv of item.conversions || []) {
      const uObj = units.find((u) => u.id === conv.unitId);
      if (uObj && !list.some((x) => x.id === uObj.id)) {
        list.push({
          id: uObj.id,
          name: uObj.name,
          factor: conv.factorToBase,
          label: `${uObj.name} (1 ${uObj.name} = ${conv.factorToBase} ${baseU?.name || 'وحدة'})`,
        });
      }
    }
    return list;
  };

  // Calculate row base quantity & validation
  const getRowCalculations = (row: DamagedItemRow) => {
    const item = items.find((i) => i.id === row.itemId);
    if (!item) {
      return { factor: 1, baseQty: 0, stock: 0, isExceeding: false, baseUnitName: 'وحدة', item: null };
    }

    const stock = getItemStock(item.id);
    const rowUnits = getRowUnits(item.id);
    const uInfo = rowUnits.find((u) => u.id === row.unitId);
    const factor = uInfo ? uInfo.factor : 1;
    const numQty = typeof row.quantity === 'number' ? row.quantity : 0;
    const baseQty = Math.round(numQty * factor * 1000) / 1000;
    const isExceeding = numQty > 0 && !canWithdraw(stock, baseQty);
    const baseUnitName = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';

    return { factor, baseQty, stock, isExceeding, baseUnitName, item };
  };

  // Aggregated usage validation to prevent total deduction exceeding available stock across rows
  const aggregatedValidation = useMemo(() => {
    const usageByItem: Record<
      string,
      { name: string; requestedBase: number; stock: number; baseUnitName: string }
    > = {};

    for (const r of rows) {
      if (!r.itemId) continue;
      const { baseQty, stock, baseUnitName, item } = getRowCalculations(r);
      if (!usageByItem[r.itemId]) {
        usageByItem[r.itemId] = {
          name: item?.name || 'صنف',
          requestedBase: 0,
          stock,
          baseUnitName,
        };
      }
      usageByItem[r.itemId].requestedBase += baseQty;
    }

    const errors: string[] = [];
    for (const [_, info] of Object.entries(usageByItem)) {
      if (!canWithdraw(info.stock, info.requestedBase)) {
        errors.push(
          `الصنف "${info.name}": الكمية التالفة الإجمالية (${info.requestedBase} ${info.baseUnitName}) تتجاوز الرصيد المتوفر بالمخزون (${info.stock} ${info.baseUnitName})!`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [rows, items, units, getItemStock]);

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validate rows
    const validRows = rows.filter((r) => r.itemId && typeof r.quantity === 'number' && r.quantity > 0);
    if (validRows.length === 0) {
      setErrorMsg('يرجى تحديد صنف واحد على الأقل وإدخال كمية صحيحة أكبر من الصفر.');
      return;
    }

    if (!aggregatedValidation.isValid) {
      setErrorMsg(aggregatedValidation.errors.join(' | '));
      return;
    }

    setIsSubmitting(true);

    try {
      const payloadItems = validRows.map((r) => ({
        itemId: r.itemId,
        unitId: r.unitId,
        quantity: Number(r.quantity),
        notes: r.notes.trim() || undefined,
      }));

      const res = await addMultiDamagedRecords({
        section: 'GENERAL', // Unified inventory
        reason: generalReason,
        generalNotes: generalNotes.trim() || undefined,
        date: new Date(date).toISOString(),
        items: payloadItems,
      });

      setIsSubmitting(false);

      if (!res.success) {
        setErrorMsg(res.error || 'حدث خطأ أثناء حفظ وتوثيق الأصناف التالفة');
        return;
      }

      onClose();
    } catch (err: any) {
      setIsSubmitting(false);
      setErrorMsg(err?.message || 'حدث خطأ غير متوقع أثناء الحفظ');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 my-8 text-right max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200 shadow-inner">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-slate-900">تسجيل أصناف تالفة</h3>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                  ينقص المخزون (-)
                </span>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                  مخزون موحد
                </span>
              </div>
              <p className="text-xs text-slate-500">
                تسجيل صنف واحد أو عدة أصناف تالفة وخصمها من الرصيد في عملية وسند واحد مع البحث السريع
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2 shrink-0">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
          {/* Top Settings: Reason & Date (Unified Inventory - No section switcher) */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* General Reason */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">سبب التلف الأساسي *</label>
                <select
                  value={generalReason}
                  onChange={(e) => setGeneralReason(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  {REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">تاريخ ووقت التلف</label>
                <input
                  type="datetime-local"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>
            </div>

            {/* General Notes */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">بيان أو ملاحظات عامة للعملية (اختياري)</label>
              <input
                type="text"
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="بيان مشترك، مثل: محضر جرد تلفيات، كسر أثناء النقل والتخزين..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Items Rows Header */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <Boxes className="w-4 h-4 text-slate-500" />
              <span className="font-black text-slate-900 text-sm">أصناف التالف ({rows.length})</span>
            </div>

            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-700" />
              <span>+ إضافة صنف تالف آخر</span>
            </button>
          </div>

          {/* Dynamic Item Rows */}
          <div className="space-y-3">
            {rows.map((row, index) => {
              const rowUnits = getRowUnits(row.itemId);
              const { isExceeding, stock, baseUnitName, item } = getRowCalculations(row);

              return (
                <div
                  key={row.rowId}
                  className={`p-3.5 bg-white border rounded-2xl space-y-2.5 transition-all ${
                    isExceeding
                      ? 'border-rose-300 bg-rose-50/30'
                      : 'border-slate-200 shadow-2xs hover:border-slate-300'
                  }`}
                >
                  {/* Row Header */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                    <span className="font-bold text-slate-500 text-[11px] flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 inline-flex items-center justify-center text-[10px] font-mono">
                        {index + 1}
                      </span>
                      <span>الصنف رقم {index + 1}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {item && (
                        <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                          المتوفر بالمخزون: <strong className="text-slate-900">{stock} {baseUnitName}</strong>
                        </span>
                      )}

                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.rowId)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف هذا الصنف من السند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Item Selector Button with SEARCH Trigger */}
                  <div>
                    <label className="block text-slate-600 font-bold mb-1 text-[11px]">
                      الصنف التالف * (اضغط للبحث والاختيار)
                    </label>
                    <button
                      type="button"
                      onClick={() => setActivePickerRowId(row.rowId)}
                      className="w-full text-right p-3 bg-slate-50 hover:bg-white border border-slate-200 hover:border-amber-500 rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer shadow-2xs group"
                    >
                      {item ? (
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-bold text-slate-900 group-hover:text-amber-700 truncate">
                            {item.name}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span dir="ltr" className="font-mono">
                              {item.code}
                            </span>
                            <span>•</span>
                            <span className={stock > 0 ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                              المتوفر: {stock} {baseUnitName}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-slate-400 text-xs">
                          <Search className="w-4 h-4 text-amber-500" />
                          <span>🔍 اضغط هنا للبحث واختيار الصنف...</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-semibold text-amber-800 bg-amber-100/70 px-2.5 py-1 rounded-lg border border-amber-200">
                          {item ? 'تغيير الصنف' : 'بحث واختيار'}
                        </span>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </div>
                    </button>
                  </div>

                  {/* Quantity & Unit & Notes Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    {/* Unit */}
                    <div className="sm:col-span-5">
                      <label className="block text-slate-600 font-bold mb-1 text-[11px]">الوحدة *</label>
                      <select
                        value={row.unitId}
                        onChange={(e) => handleRowChange(row.rowId, 'unitId', e.target.value)}
                        disabled={rowUnits.length === 0}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 text-xs focus:bg-white focus:border-amber-500"
                        required
                      >
                        {rowUnits.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="sm:col-span-4">
                      <label className="block text-slate-600 font-bold mb-1 text-[11px]">الكمية التالفة *</label>
                      <input
                        type="number"
                        step="any"
                        min="0.001"
                        value={row.quantity}
                        onChange={(e) =>
                          handleRowChange(
                            row.rowId,
                            'quantity',
                            e.target.value === '' ? '' : Number(e.target.value)
                          )
                        }
                        placeholder="0"
                        className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono text-xs font-black focus:outline-none focus:ring-2 ${
                          isExceeding
                            ? 'border-rose-400 text-rose-700 focus:ring-rose-500/20'
                            : 'border-slate-200 text-slate-900 focus:ring-amber-500/20 focus:border-amber-500'
                        }`}
                        required
                      />
                    </div>

                    {/* Base Quantity Preview */}
                    <div className="sm:col-span-3 flex flex-col justify-end">
                      <div className="px-2.5 py-2 bg-slate-100 rounded-xl text-[11px] text-slate-700 text-center font-medium">
                        <span className="block text-[10px] text-slate-500">بالأساسية:</span>
                        <span className="font-bold font-mono text-xs">
                          {getRowCalculations(row).baseQty} {baseUnitName}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row Specific Note */}
                  <div>
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => handleRowChange(row.rowId, 'notes', e.target.value)}
                      placeholder="ملاحظة خاصة بهذا الصنف التالف (اختياري)..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:bg-white focus:border-amber-500"
                    />
                  </div>

                  {/* Stock Warning */}
                  {isExceeding && (
                    <div className="p-2 rounded-lg bg-rose-100 border border-rose-300 text-rose-800 text-[11px] flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>
                        تنبيه: الكمية التالفة ({getRowCalculations(row).baseQty} {baseUnitName}) تتجاوز الرصيد المتوفر بالمخزون ({stock} {baseUnitName})!
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Add Another Item Button */}
          <button
            type="button"
            onClick={handleAddRow}
            className="w-full py-3 border-2 border-dashed border-amber-300 hover:border-amber-500 bg-amber-50/50 hover:bg-amber-50 text-amber-900 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
          >
            <Plus className="w-4 h-4" />
            <span>+ إضافة صنف تالف آخر إلى العملية</span>
          </button>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !aggregatedValidation.isValid}
              className="flex items-center gap-2 px-6 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-md transition-all cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'جاري التسجيل...'
                  : `تأكيد تسجيل التالف وخصمه من المخزون (${rows.length} أصناف)`}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Item Picker Bottom Sheet for Fast Search */}
      <ItemPickerBottomSheet
        isOpen={activePickerRowId !== null}
        onClose={() => setActivePickerRowId(null)}
        selectedItemId={
          (activePickerRowId
            ? rows.find((r) => r.rowId === activePickerRowId)?.itemId
            : '') || ''
        }
        onSelectItem={(chosenId) => {
          if (activePickerRowId) {
            handleRowChange(activePickerRowId, 'itemId', chosenId);
          }
          setActivePickerRowId(null);
        }}
        movementType="OUT"
        items={availableItems}
      />
    </div>
  );
};
