import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  Plus,
  Trash2,
  Calendar,
  Layers,
  FileText,
  Package,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { StockMovement } from '../../types/inventory';
import { canWithdraw } from '../../utils/stockRules';

interface FactoryMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'MFG_OUT' | 'MFG_IN';
  onSuccess: (movement: StockMovement) => void;
}

interface FactoryItemRow {
  rowId: string;
  itemId: string;
  unitId: string;
  quantity: number | '';
  notes: string;
}

export const FactoryMovementModal: React.FC<FactoryMovementModalProps> = ({
  isOpen,
  onClose,
  type,
  onSuccess,
}) => {
  const {
    items,
    units,
    categories,
    getItemStock,
    addMultiItemFactoryMovement,
    generateFactoryReferenceNumber,
  } = useInventory();

  const isOut = type === 'MFG_OUT';

  // Form states
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [rows, setRows] = useState<FactoryItemRow[]>([
    { rowId: 'row_1', itemId: '', unitId: '', quantity: '', notes: '' },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Active items (not deleted)
  const activeItems = useMemo(() => {
    return items.filter((i) => !i.isDeleted && !i.isArchived);
  }, [items]);

  // Preview reference number
  const previewRefNumber = useMemo(() => {
    return generateFactoryReferenceNumber(type);
  }, [generateFactoryReferenceNumber, type]);

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
  const handleRowChange = (rowId: string, field: keyof FactoryItemRow, value: any) => {
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

  // Available units for a row
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

  // Row validation & stock calculations
  const getRowCalculations = (row: FactoryItemRow) => {
    const item = items.find((i) => i.id === row.itemId);
    if (!item) return { factor: 1, baseQty: 0, stock: 0, isExceeding: false, baseUnitName: '' };

    const stock = getItemStock(item.id);
    const rowUnits = getRowUnits(item.id);
    const uInfo = rowUnits.find((u) => u.id === row.unitId);
    const factor = uInfo ? uInfo.factor : 1;
    const numQty = typeof row.quantity === 'number' ? row.quantity : 0;
    const baseQty = Math.round(numQty * factor * 1000) / 1000;
    const isExceeding = isOut && numQty > 0 && !canWithdraw(stock, baseQty);
    const baseUnitName = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';

    return { factor, baseQty, stock, isExceeding, baseUnitName };
  };

  // Grand summary stats
  const totalItemsCount = rows.filter((r) => Boolean(r.itemId)).length;
  const totalBaseQty = rows.reduce((acc, r) => {
    const { baseQty } = getRowCalculations(r);
    return acc + baseQty;
  }, 0);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setFormError(null);

    if (rows.length === 0) {
      setFormError('يرجى إضافة صنف واحد على الأقل.');
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.itemId) {
        setFormError(`يرجى اختيار الصنف في البند رقم ${i + 1}.`);
        return;
      }
      const numQty = typeof r.quantity === 'number' ? r.quantity : 0;
      if (!numQty || numQty <= 0) {
        setFormError(`يرجى إدخال كمية صحيحة أكبر من الصفر في البند رقم ${i + 1}.`);
        return;
      }
      const { isExceeding, stock, baseQty, baseUnitName } = getRowCalculations(r);
      if (isExceeding) {
        const item = items.find((itm) => itm.id === r.itemId);
        setFormError(
          `عفواً، الكمية المطلوبة للصنف "${item?.name || ''}" (${numQty} = ${baseQty} ${baseUnitName}) تتجاوز الرصيد المتوفر (${stock} ${baseUnitName}). يمنع النظام تماماً الأرصدة السالبة!`
        );
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const res = await addMultiItemFactoryMovement({
        type,
        date,
        notes: generalNotes,
        items: rows.map((r) => ({
          itemId: r.itemId,
          unitId: r.unitId,
          quantity: Number(r.quantity),
          notes: r.notes.trim() || undefined,
        })),
      });

      if (res.success && res.movements && res.movements.length > 0) {
        onSuccess(res.movements[0]);
        onClose();
      } else {
        setFormError(res.error || 'تعذر حفظ الحركة في قاعدة البيانات.');
      }
    } catch (err: any) {
      setFormError(err?.message || 'حدث خطأ غير متوقع أثناء الحفظ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="relative w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden text-right animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div
          className={`p-6 border-b text-white flex items-center justify-between shrink-0 ${
            isOut
              ? 'bg-gradient-to-r from-rose-700 via-rose-800 to-slate-900 border-rose-800'
              : 'bg-gradient-to-r from-emerald-700 via-emerald-800 to-slate-900 border-emerald-800'
          }`}
        >
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
              {isOut ? <ArrowUpRight className="w-6 h-6 text-rose-200" /> : <ArrowDownLeft className="w-6 h-6 text-emerald-200" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-black tracking-tight">
                  {isOut ? 'أمر صرف وخروج للمصنع' : 'استلام وارد من المصنع'}
                </h3>
                <span className="px-2.5 py-0.5 rounded-full bg-white/20 text-white text-[10px] font-mono font-black border border-white/30">
                  {previewRefNumber}
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">
                {isOut
                  ? 'تسجيل خروج مواد أو منتجات وتخفيض رصيد المخزون مع إمكانية إضافة عدة أصناف'
                  : 'استلام بضاعة مصنّعة من المصنع وإضافتها تلقائياً للمخزون'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-white/70 hover:text-white rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {formError && (
          <div className="m-4 mb-0 p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2 animate-shake shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1">
          {/* General Metadata: Date & Notes */}
          <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span>تاريخ السند *</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>ملاحظات وبيان عام للسند</span>
              </label>
              <input
                type="text"
                value={generalNotes}
                onChange={(e) => setGeneralNotes(e.target.value)}
                placeholder="مثال: تشغيل طلبية خاصة، إرسال للمصنع للطباعة..."
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Rows Header */}
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-sm">
                {isOut ? 'الأصناف المصروفة للمصنع' : 'الأصناف المستلمة من المصنع'}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[11px] font-bold">
                {rows.length} {rows.length === 1 ? 'صنف' : 'أصناف'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleAddRow}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs transition-colors cursor-pointer border ${
                isOut
                  ? 'bg-rose-50 hover:bg-rose-100 border-rose-200 text-rose-900'
                  : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة صنف آخر للسند +</span>
            </button>
          </div>

          {/* Item Rows */}
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
                    {/* Item */}
                    <div className="sm:col-span-5">
                      <label className="block text-slate-600 font-bold mb-1 text-[11px]">الصنف *</label>
                      <select
                        value={row.itemId}
                        onChange={(e) => handleRowChange(row.rowId, 'itemId', e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        required
                      >
                        <option value="">-- اختر الصنف --</option>
                        {activeItems.map((itm) => {
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
                      <label className="block text-slate-600 font-bold mb-1 text-[11px]">الكمية *</label>
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
                            : 'border-slate-200 text-slate-900 focus:ring-emerald-500/20 focus:border-emerald-500'
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
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 disabled:opacity-50"
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
                      placeholder="ملاحظات خاصة بهذا البند (اختياري)..."
                      className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-lg text-[11px] text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add Another Row Dashed Button */}
          <div>
            <button
              type="button"
              onClick={handleAddRow}
              className={`w-full py-2.5 border-2 border-dashed rounded-2xl font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                isOut
                  ? 'border-rose-300 hover:border-rose-400 bg-rose-50/50 hover:bg-rose-50 text-rose-900'
                  : 'border-emerald-300 hover:border-emerald-400 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-900'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>إضافة صنف آخر إلى أمر {isOut ? 'الصرف' : 'الاستلام'}</span>
            </button>
          </div>

          {/* Summary Box */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs font-bold text-slate-800">
            <div className="flex items-center gap-2">
              <Package className={`w-4 h-4 ${isOut ? 'text-rose-600' : 'text-emerald-600'}`} />
              <span>ملخص السند:</span>
              <span className="text-slate-500">{totalItemsCount} أصناف مسجلة</span>
            </div>
            <div className={`font-mono font-black ${isOut ? 'text-rose-700' : 'text-emerald-700'}`}>
              إجمالي الكميات: {Math.round(totalBaseQty * 1000) / 1000} وحدة أساسية
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
              className={`flex items-center gap-2 px-6 py-2.5 text-white font-bold rounded-xl shadow-sm transition-colors cursor-pointer disabled:opacity-50 ${
                isOut ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
              }`}
            >
              {isOut ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
              <span>
                {isSubmitting
                  ? 'جاري الحفظ...'
                  : `تأكيد ${isOut ? 'صرف وخروج' : 'استلام وارد'} (${rows.length} ${rows.length === 1 ? 'صنف' : 'أصناف'})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
