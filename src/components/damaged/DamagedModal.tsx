import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, Plus, Trash2, ShieldAlert, Package, CheckCircle2 } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { DamagedSection, DamagedReason } from '../../types/inventory';
import { canWithdraw } from '../../utils/stockRules';

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
  const { items, units, categories, getItemStock, addMultiDamagedRecords } = useInventory();

  const [section, setSection] = useState<DamagedSection>('GENERAL');
  const [generalReason, setGeneralReason] = useState<DamagedReason | string>('تلف تخزين');
  const [generalNotes, setGeneralNotes] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 16));
  const [rows, setRows] = useState<DamagedItemRow[]>([
    { rowId: 'row_1', itemId: '', unitId: '', quantity: '', notes: '' },
  ]);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active items filtered by section
  const availableItems = useMemo(() => {
    return items.filter((i) => {
      if (i.isArchived || i.isDeleted) return false;
      if (section === 'PRODUCTION') {
        return Boolean(i.isProductionItem);
      }
      return true;
    });
  }, [items, section]);

  // Add another item row
  const handleAddRow = () => {
    const newId = 'row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    setRows((prev) => [...prev, { rowId: newId, itemId: '', unitId: '', quantity: '', notes: '' }]);
  };

  // Remove a row
  const handleRemoveRow = (rowId: string) => {
    if (rows.length === 1) return;
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
  };

  // Helper for available units for a row's item
  const getRowUnits = (itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    if (!item) return [];
    const list: { id: string; name: string; factor: number }[] = [];
    const baseU = units.find((u) => u.id === item.baseUnitId);
    if (baseU) {
      list.push({ id: baseU.id, name: baseU.name, factor: 1 });
    }
    for (const conv of item.conversions || []) {
      const uObj = units.find((u) => u.id === conv.unitId);
      if (uObj && !list.some((x) => x.id === uObj.id)) {
        list.push({ id: uObj.id, name: uObj.name, factor: conv.factorToBase });
      }
    }
    return list;
  };

  // Calculate row base quantity & validation
  const getRowCalculations = (row: DamagedItemRow) => {
    const item = items.find((i) => i.id === row.itemId);
    if (!item) return { factor: 1, baseQty: 0, stock: 0, isExceeding: false, baseUnitName: '' };

    const stock = getItemStock(item.id);
    const rowUnits = getRowUnits(item.id);
    const uInfo = rowUnits.find((u) => u.id === row.unitId);
    const factor = uInfo ? uInfo.factor : 1;
    const numQty = typeof row.quantity === 'number' ? row.quantity : 0;
    const baseQty = Math.round(numQty * factor * 1000) / 1000;
    const isExceeding = numQty > 0 && !canWithdraw(stock, baseQty);
    const baseUnitName = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';

    return { factor, baseQty, stock, isExceeding, baseUnitName };
  };

  // Grand summary stats
  const totalItemsCount = rows.filter((r) => Boolean(r.itemId)).length;
  const totalBaseQty = rows.reduce((acc, r) => {
    const { baseQty } = getRowCalculations(r);
    return acc + baseQty;
  }, 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (rows.length === 0) {
      setErrorMsg('يرجى إضافة صنف واحد على الأقل.');
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.itemId) {
        setErrorMsg(`يرجى اختيار الصنف في البند رقم ${i + 1}.`);
        return;
      }
      const numQty = typeof r.quantity === 'number' ? r.quantity : 0;
      if (!numQty || numQty <= 0) {
        setErrorMsg(`يرجى إدخال كمية صحيحة أكبر من الصفر في البند رقم ${i + 1}.`);
        return;
      }
      const { isExceeding, stock, baseQty, baseUnitName } = getRowCalculations(r);
      if (isExceeding) {
        const item = items.find((itm) => itm.id === r.itemId);
        setErrorMsg(
          `عفواً، الكمية المطلوبة للصنف "${item?.name || ''}" (${numQty} = ${baseQty} ${baseUnitName}) تتجاوز الرصيد المتوفر (${stock} ${baseUnitName}).`
        );
        return;
      }
    }

    setIsSubmitting(true);

    const payload = {
      section,
      reason: generalReason,
      generalNotes,
      date: date ? (date.includes('T') ? date : `${date}T${new Date().toTimeString().split(' ')[0]}`) : new Date().toISOString(),
      items: rows.map((r) => ({
        itemId: r.itemId,
        unitId: r.unitId,
        quantity: Number(r.quantity),
        notes: r.notes.trim() || undefined,
      })),
    };

    const res = await addMultiDamagedRecords(payload);

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'حدث خطأ أثناء تسجيل التالف');
      return;
    }

    // Reset & close
    setRows([{ rowId: 'row_1', itemId: '', unitId: '', quantity: '', notes: '' }]);
    setGeneralNotes('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 my-8 text-right flex flex-col max-h-[92vh]">
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
              </div>
              <p className="text-xs text-slate-500">
                إمكانية تسجيل صنف واحد أو عدة أصناف تالفة وخصمها من الرصيد في عملية وسند واحد
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
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2 animate-shake shrink-0">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs overflow-y-auto pr-1 flex-1">
          {/* Top Settings: Section, Reason, Date */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Section */}
              <div>
                <label className="block text-slate-700 font-bold mb-1.5">القسم المستهدف *</label>
                <div className="grid grid-cols-2 gap-1.5 p-1 bg-white border border-slate-200 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setSection('GENERAL')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      section === 'GENERAL'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    المخزون العام
                  </button>
                  <button
                    type="button"
                    onClick={() => setSection('PRODUCTION')}
                    className={`py-1.5 px-2 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                      section === 'PRODUCTION'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    الإنتاج والتصنيع
                  </button>
                </div>
              </div>

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
              <label className="block text-slate-700 font-bold mb-1">ملاحظات عامة للعملية (اختياري)</label>
              <input
                type="text"
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="بيان مشترك، مثل: محضر جرد تلفيات، كسر أثناء النقل..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
              />
            </div>
          </div>

          {/* Items Rows Header */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-sm">قائمة الأصناف التالفة</span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                {rows.length} {rows.length === 1 ? 'صنف' : 'أصناف'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleAddRow}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-amber-700" />
              <span>إضافة صنف آخر +</span>
            </button>
          </div>

          {/* Rows List */}
          <div className="space-y-3">
            {rows.map((row, index) => {
              const rowUnits = getRowUnits(row.itemId);
              const { isExceeding, stock, baseUnitName } = getRowCalculations(row);
              const selectedItem = items.find((i) => i.id === row.itemId);

              return (
                <div
                  key={row.rowId}
                  className={`p-3.5 bg-white border rounded-2xl space-y-2.5 transition-all ${
                    isExceeding
                      ? 'border-rose-300 bg-rose-50/30'
                      : 'border-slate-200 shadow-2xs hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-500 text-[11px] flex items-center gap-1">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 inline-flex items-center justify-center text-[10px] font-mono">
                        {index + 1}
                      </span>
                      <span>البند {index + 1}</span>
                    </span>

                    <div className="flex items-center gap-2">
                      {selectedItem && (
                        <span className="text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md font-mono">
                          المتوفر بالمخزون: <strong className="text-slate-900">{stock} {baseUnitName}</strong>
                        </span>
                      )}

                      {rows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveRow(row.rowId)}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف هذا البند"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                    {/* Item Picker */}
                    <div className="sm:col-span-5">
                      <label className="block text-slate-600 font-bold mb-1 text-[11px]">الصنف *</label>
                      <select
                        value={row.itemId}
                        onChange={(e) => handleRowChange(row.rowId, 'itemId', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                        required
                      >
                        <option value="">-- اختر الصنف --</option>
                        {availableItems.map((itm) => {
                          const cat = categories.find((c) => c.id === itm.categoryId);
                          return (
                            <option key={itm.id} value={itm.id}>
                              {itm.name} ({itm.code}) {cat ? `[${cat.name}]` : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="sm:col-span-3">
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

                    {/* Unit */}
                    <div className="sm:col-span-4">
                      <label className="block text-slate-600 font-bold mb-1 text-[11px]">الوحدة *</label>
                      <select
                        value={row.unitId}
                        onChange={(e) => handleRowChange(row.rowId, 'unitId', e.target.value)}
                        disabled={!row.itemId}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 disabled:opacity-50"
                        required
                      >
                        {rowUnits.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} {u.factor !== 1 ? `(${u.factor} أساسي)` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row Note */}
                  <div>
                    <input
                      type="text"
                      value={row.notes}
                      onChange={(e) => handleRowChange(row.rowId, 'notes', e.target.value)}
                      placeholder="ملاحظات تفصيلية خاصة بهذا الصنف (اختياري)..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Another Item Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleAddRow}
              className="w-full py-2.5 border-2 border-dashed border-amber-300 hover:border-amber-400 bg-amber-50/50 hover:bg-amber-50 rounded-2xl font-bold text-amber-900 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-amber-700" />
              <span>إضافة صنف تالف آخر إلى العملية</span>
            </button>
          </div>

          {/* Summary Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-800">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-amber-600" />
              <span>ملخص السند:</span>
              <span className="text-slate-500">{totalItemsCount} أصناف مسجلة</span>
            </div>
            <div className="font-mono text-rose-700 font-black">
              إجمالي الكميات المخصومة: {Math.round(totalBaseQty * 1000) / 1000} وحدة أساسية
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 shrink-0">
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
              disabled={isSubmitting || totalItemsCount === 0}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <AlertTriangle className="w-4 h-4" />
              <span>
                {isSubmitting
                  ? 'جاري الحفظ والخصم...'
                  : `تأكيد تسجيل التالف (${rows.length} ${rows.length === 1 ? 'صنف' : 'أصناف'})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
