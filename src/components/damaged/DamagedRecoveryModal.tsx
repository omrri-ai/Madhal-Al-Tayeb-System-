import React, { useState, useMemo, useEffect } from 'react';
import { X, RotateCcw, PackageCheck, AlertCircle, Sparkles, CheckCircle2 } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { DamagedRecord, DamagedRecoveryReason } from '../../types/inventory';

interface DamagedRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedRecord?: DamagedRecord | null;
}

const RECOVERY_REASONS: DamagedRecoveryReason[] = [
  'تم الإصلاح بالمصنع',
  'تم الإصلاح محلياً / بالورشة',
  'إعادة تأهيل وتجديد',
  'سليم بعد الفحص والمعاينة',
  'العثور على صنف مفقود',
  'أخرى',
];

export const DamagedRecoveryModal: React.FC<DamagedRecoveryModalProps> = ({
  isOpen,
  onClose,
  preselectedRecord,
}) => {
  const { items, units, getItemStock, damagedRecords, recoverDamagedRecord } = useInventory();

  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [itemId, setItemId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState<DamagedRecoveryReason | string>('تم الإصلاح بالمصنع');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available damaged records that still have unrecovered quantities
  const recoverableDamagedRecords = useMemo(() => {
    return damagedRecords.filter((r) => {
      const recoveredBase = r.recoveredBaseQuantity || 0;
      return r.baseQuantity - recoveredBase > 0.001;
    });
  }, [damagedRecords]);

  // Sync state when preselectedRecord changes or modal opens
  useEffect(() => {
    if (preselectedRecord) {
      setSelectedRecordId(preselectedRecord.id);
      setItemId(preselectedRecord.itemId);
      setUnitId(preselectedRecord.unitId);
      const remainingBase =
        preselectedRecord.baseQuantity - (preselectedRecord.recoveredBaseQuantity || 0);
      const factor = preselectedRecord.factorApplied || 1;
      const remainingInUnit = Math.round((remainingBase / factor) * 1000) / 1000;
      setQuantity(remainingInUnit > 0 ? remainingInUnit : '');
    } else if (recoverableDamagedRecords.length > 0) {
      const first = recoverableDamagedRecords[0];
      setSelectedRecordId(first.id);
      setItemId(first.itemId);
      setUnitId(first.unitId);
      const remainingBase = first.baseQuantity - (first.recoveredBaseQuantity || 0);
      const factor = first.factorApplied || 1;
      const remainingInUnit = Math.round((remainingBase / factor) * 1000) / 1000;
      setQuantity(remainingInUnit > 0 ? remainingInUnit : '');
    } else {
      setSelectedRecordId('');
      if (items.length > 0) {
        setItemId(items[0].id);
        setUnitId(items[0].baseUnitId);
      }
      setQuantity('');
    }
    setErrorMsg(null);
  }, [preselectedRecord, isOpen, recoverableDamagedRecords, items]);

  const activeRecord = useMemo(() => {
    if (!selectedRecordId) return null;
    return damagedRecords.find((r) => r.id === selectedRecordId) || null;
  }, [damagedRecords, selectedRecordId]);

  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === itemId);
  }, [items, itemId]);

  // Available units for the item
  const itemUnits = useMemo(() => {
    if (!selectedItem) return [];
    const list: { id: string; name: string; factor: number }[] = [];
    const baseU = units.find((u) => u.id === selectedItem.baseUnitId);
    if (baseU) {
      list.push({ id: baseU.id, name: baseU.name, factor: 1 });
    }
    for (const conv of selectedItem.conversions || []) {
      const uObj = units.find((u) => u.id === conv.unitId);
      if (uObj && !list.some((x) => x.id === uObj.id)) {
        list.push({ id: uObj.id, name: uObj.name, factor: conv.factorToBase });
      }
    }
    return list;
  }, [selectedItem, units]);

  // Handle changing damaged record dropdown
  const handleRecordChange = (recId: string) => {
    setSelectedRecordId(recId);
    if (recId === 'DIRECT_RECOVERY') {
      return;
    }
    const rec = damagedRecords.find((r) => r.id === recId);
    if (rec) {
      setItemId(rec.itemId);
      setUnitId(rec.unitId);
      const remainingBase = rec.baseQuantity - (rec.recoveredBaseQuantity || 0);
      const factor = rec.factorApplied || 1;
      const remainingInUnit = Math.round((remainingBase / factor) * 1000) / 1000;
      setQuantity(remainingInUnit > 0 ? remainingInUnit : '');
    }
  };

  const selectedUnitFactor = useMemo(() => {
    const found = itemUnits.find((u) => u.id === unitId);
    return found ? found.factor : 1;
  }, [itemUnits, unitId]);

  const numQty = typeof quantity === 'number' ? quantity : 0;
  const baseQty = Math.round(numQty * selectedUnitFactor * 1000) / 1000;

  const remainingBaseAllowed = useMemo(() => {
    if (!activeRecord) return Infinity;
    return Math.round((activeRecord.baseQuantity - (activeRecord.recoveredBaseQuantity || 0)) * 1000) / 1000;
  }, [activeRecord]);

  const isExceedingAllowed = activeRecord ? baseQty > remainingBaseAllowed + 0.001 : false;

  const currentStock = useMemo(() => {
    if (!selectedItem) return 0;
    return getItemStock(selectedItem.id);
  }, [selectedItem, getItemStock]);

  const projectedStock = Math.round((currentStock + baseQty) * 1000) / 1000;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!itemId) {
      setErrorMsg('يرجى اختيار الصنف المسترد.');
      return;
    }
    if (!numQty || numQty <= 0) {
      setErrorMsg('يرجى إدخال كمية صحيحة أكبر من الصفر.');
      return;
    }
    if (isExceedingAllowed && activeRecord) {
      const unitObj = units.find((u) => u.id === unitId);
      const maxUnitQty = Math.round((remainingBaseAllowed / selectedUnitFactor) * 1000) / 1000;
      setErrorMsg(
        `الكمية المطلوبة (${numQty} ${unitObj?.name || ''}) تتجاوز المتبقي من هذا السجل (${maxUnitQty} ${unitObj?.name || ''}).`
      );
      return;
    }

    setIsSubmitting(true);
    const res = await recoverDamagedRecord({
      damagedRecordId: activeRecord ? activeRecord.id : undefined,
      itemId,
      unitId: unitId || selectedItem?.baseUnitId || '',
      quantity: numQty,
      reason,
      notes,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'حدث خطأ أثناء تسجيل العودة من التالف');
      return;
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-100 p-6 my-8 text-right">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 shadow-inner">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-base font-black text-slate-900">راجع من التالف / استرداد للمخزون</h3>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                  يزيد الرصيد (+)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                إعادة الأصناف التي تم إصلاحها أو تأهيلها أو العثور عليها إلى رصيد المخزون
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
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Linked Record selection */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">
              ربط بسجل تالف سابق (اختياري / موصى به)
            </label>
            <select
              value={selectedRecordId}
              onChange={(e) => handleRecordChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="DIRECT_RECOVERY">-- استرداد مباشر حر (بدون ربط بسجل محدد) --</option>
              {recoverableDamagedRecords.map((r) => {
                const it = items.find((i) => i.id === r.itemId);
                const un = units.find((u) => u.id === r.unitId);
                const remBase = Math.round((r.baseQuantity - (r.recoveredBaseQuantity || 0)) * 1000) / 1000;
                const dateStr = new Date(r.date).toLocaleDateString('ar-SA');
                return (
                  <option key={r.id} value={r.id}>
                    {it?.name || 'صنف'} | متبقي للتلف: {remBase} {un?.name || 'وحدة'} | تاريخ: {dateStr} (سبب: {r.reason})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Item Selector if Direct Recovery */}
          {(!activeRecord || selectedRecordId === 'DIRECT_RECOVERY') && (
            <div>
              <label className="block text-slate-700 font-bold mb-1.5">الصنف المسترد *</label>
              <select
                value={itemId}
                onChange={(e) => {
                  setItemId(e.target.value);
                  const found = items.find((i) => i.id === e.target.value);
                  if (found) setUnitId(found.baseUnitId);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                required
              >
                <option value="">-- اختر الصنف --</option>
                {items
                  .filter((i) => !i.isDeleted && !i.isArchived)
                  .map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.code})
                    </option>
                  ))}
              </select>
            </div>
          )}

          {/* Quantity & Unit */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-700 font-bold">الكمية المستردة *</label>
                {activeRecord && (
                  <span className="text-[10px] text-slate-500 font-mono">
                    المتاح للاسترداد: {remainingBaseAllowed}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="any"
                min="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0"
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl font-mono text-sm font-black focus:outline-none focus:ring-2 ${
                  isExceedingAllowed
                    ? 'border-rose-400 text-rose-700 focus:ring-rose-500/20'
                    : 'border-slate-200 text-slate-900 focus:ring-emerald-500/20 focus:border-emerald-500'
                }`}
                required
              />
            </div>

            <div>
              <label className="block text-slate-700 font-bold mb-1.5">الوحدة *</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                required
              >
                {itemUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} {u.factor !== 1 ? `(${u.factor} أساسي)` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Recovery Reason */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">سبب الاسترداد / العودة *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              {RECOVERY_REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">بيان أو ملاحظات إضافية</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: تم الاستلام بعد الإصلاح، بحالة ممتازة..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          {/* Visual Stock Simulation Box */}
          {selectedItem && (
            <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                <span className="flex items-center gap-1.5">
                  <PackageCheck className="w-4 h-4 text-emerald-600" />
                  <span>محاكاة أثر الحركة على المخزون:</span>
                </span>
                <span className="font-mono text-emerald-700">+{baseQty} وحدة أساسية</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-200/60">
                <div className="text-slate-600">
                  <span>الرصيد الحالي: </span>
                  <span className="font-mono font-bold text-slate-900">{currentStock}</span>
                </div>
                <div className="text-emerald-800 font-bold">
                  <span>الرصيد بعد الاسترداد: </span>
                  <span className="font-mono font-black text-emerald-700">{projectedStock}</span>
                </div>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
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
              disabled={isSubmitting || isExceedingAllowed || numQty <= 0}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl shadow-sm transition-colors cursor-pointer"
            >
              <PackageCheck className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ والتحديث...' : 'تأكيد العودة للمخزون'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
