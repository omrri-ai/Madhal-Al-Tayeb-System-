import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  RotateCcw,
  PackageCheck,
  AlertCircle,
  Search,
  Calendar,
  Info,
} from 'lucide-react';
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

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [unitId, setUnitId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState<DamagedRecoveryReason | string>('تم الإصلاح بالمصنع');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available damaged records that still have unrecovered quantities ONLY
  const recoverableDamagedRecords = useMemo(() => {
    return damagedRecords.filter((r) => {
      const recoveredBase = r.recoveredBaseQuantity || 0;
      return r.baseQuantity - recoveredBase > 0.001;
    });
  }, [damagedRecords]);

  // Search filtered recoverable records
  const filteredRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return recoverableDamagedRecords;

    return recoverableDamagedRecords.filter((r) => {
      const it = items.find((i) => i.id === r.itemId);
      const itemName = (it?.name || '').toLowerCase();
      const itemCode = (it?.code || '').toLowerCase();
      const reasonStr = (r.reason || '').toLowerCase();
      const notesStr = (r.notes || '').toLowerCase();
      const refStr = (r.movementId || r.id).toLowerCase();

      return (
        itemName.includes(q) ||
        itemCode.includes(q) ||
        reasonStr.includes(q) ||
        notesStr.includes(q) ||
        refStr.includes(q)
      );
    });
  }, [recoverableDamagedRecords, searchQuery, items]);

  // Sync state when preselectedRecord changes or modal opens
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg(null);
    setSearchQuery('');

    if (preselectedRecord) {
      setSelectedRecordId(preselectedRecord.id);
      setUnitId(preselectedRecord.unitId);
      const remainingBase =
        preselectedRecord.baseQuantity - (preselectedRecord.recoveredBaseQuantity || 0);
      const factor = preselectedRecord.factorApplied || 1;
      const remainingInUnit = Math.round((remainingBase / factor) * 1000) / 1000;
      setQuantity(remainingInUnit > 0 ? remainingInUnit : '');
    } else if (recoverableDamagedRecords.length > 0) {
      const first = recoverableDamagedRecords[0];
      setSelectedRecordId(first.id);
      setUnitId(first.unitId);
      const remainingBase = first.baseQuantity - (first.recoveredBaseQuantity || 0);
      const factor = first.factorApplied || 1;
      const remainingInUnit = Math.round((remainingBase / factor) * 1000) / 1000;
      setQuantity(remainingInUnit > 0 ? remainingInUnit : '');
    } else {
      setSelectedRecordId('');
      setUnitId('');
      setQuantity('');
    }
  }, [preselectedRecord, isOpen, recoverableDamagedRecords]);

  const activeRecord = useMemo(() => {
    if (!selectedRecordId) return null;
    return recoverableDamagedRecords.find((r) => r.id === selectedRecordId) || null;
  }, [recoverableDamagedRecords, selectedRecordId]);

  const selectedItem = useMemo(() => {
    if (!activeRecord) return null;
    return items.find((i) => i.id === activeRecord.itemId);
  }, [items, activeRecord]);

  // Units for the item
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

  // Handle selecting a record
  const handleSelectRecord = (rec: DamagedRecord) => {
    setSelectedRecordId(rec.id);
    setUnitId(rec.unitId);
    const remainingBase = rec.baseQuantity - (rec.recoveredBaseQuantity || 0);
    const factor = rec.factorApplied || 1;
    const remainingInUnit = Math.round((remainingBase / factor) * 1000) / 1000;
    setQuantity(remainingInUnit > 0 ? remainingInUnit : '');
    setErrorMsg(null);
  };

  const selectedUnitFactor = useMemo(() => {
    const found = itemUnits.find((u) => u.id === unitId);
    return found ? found.factor : 1;
  }, [itemUnits, unitId]);

  const numQty = typeof quantity === 'number' ? quantity : 0;
  const baseQty = Math.round(numQty * selectedUnitFactor * 1000) / 1000;

  const remainingBaseAllowed = useMemo(() => {
    if (!activeRecord) return 0;
    return Math.round((activeRecord.baseQuantity - (activeRecord.recoveredBaseQuantity || 0)) * 1000) / 1000;
  }, [activeRecord]);

  const isExceedingAllowed = activeRecord ? baseQty > remainingBaseAllowed + 0.001 : false;

  const currentStock = useMemo(() => {
    if (!selectedItem) return 0;
    return getItemStock(selectedItem.id);
  }, [selectedItem, getItemStock]);

  const projectedStock = Math.round((currentStock + baseQty) * 1000) / 1000;
  const baseUnitName = units.find((u) => u.id === selectedItem?.baseUnitId)?.name || 'وحدة';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!activeRecord || !selectedItem) {
      setErrorMsg('يرجى اختيار صنف تالف من القائمة المتاحة للاسترداد.');
      return;
    }

    if (!numQty || numQty <= 0) {
      setErrorMsg('يرجى إدخال كمية صحيحة أكبر من الصفر.');
      return;
    }

    if (isExceedingAllowed) {
      const unitObj = units.find((u) => u.id === unitId);
      const maxUnitQty = Math.round((remainingBaseAllowed / selectedUnitFactor) * 1000) / 1000;
      setErrorMsg(
        `الكمية المطلوبة (${numQty} ${unitObj?.name || ''}) تتجاوز المتبقي من هذا السجل التالف (${maxUnitQty} ${unitObj?.name || ''}).`
      );
      return;
    }

    setIsSubmitting(true);
    const res = await recoverDamagedRecord({
      damagedRecordId: activeRecord.id,
      itemId: selectedItem.id,
      unitId: unitId || selectedItem.baseUnitId,
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
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-5 my-8 text-right max-h-[92vh] flex flex-col">
        {/* Header - Simple & Clean */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-900">راجع من التالف / إعادة للمخزون</h3>
              <p className="text-[11px] text-slate-500">اختر الصنف المخصوم وحدد الكمية لإعادتها للرصيد</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {recoverableDamagedRecords.length === 0 ? (
          <div className="py-10 px-4 text-center space-y-3 bg-slate-50 rounded-xl border border-slate-200">
            <div className="w-10 h-10 mx-auto rounded-full bg-amber-100 text-amber-600 flex items-center justify-center">
              <Info className="w-5 h-5" />
            </div>
            <h4 className="text-xs font-bold text-slate-900">لا توجد أصناف تالفة مؤهلة للاسترداد حالياً</h4>
            <p className="text-[11px] text-slate-500 max-w-sm mx-auto leading-relaxed">
              لا يمكن إضافة أصناف كـ «راجع من التالف» إلا للأصناف التي خُصمت فعلياً من المخزون في قسم التالف.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold rounded-lg transition"
            >
              إغلاق
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 text-xs overflow-y-auto pr-1 flex-1">
            {/* Search and Select Damaged Item */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">
                اختر الصنف من سجل التلف المخصوم *
              </label>
              <div className="relative mb-1.5">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث باسم الصنف أو الكود..."
                  className="w-full pl-3 pr-9 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-200"
                />
              </div>

              {/* Clean List */}
              <div className="space-y-1.5 max-h-36 overflow-y-auto p-1 border border-slate-200 rounded-xl bg-slate-50">
                {filteredRecords.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-[11px]">لا توجد نتائج مطابقة</div>
                ) : (
                  filteredRecords.map((r) => {
                    const it = items.find((i) => i.id === r.itemId);
                    const un = units.find((u) => u.id === r.unitId);
                    const remBase =
                      Math.round((r.baseQuantity - (r.recoveredBaseQuantity || 0)) * 1000) / 1000;
                    const isSelected = selectedRecordId === r.id;

                    return (
                      <div
                        key={r.id}
                        onClick={() => handleSelectRecord(r)}
                        className={`p-2.5 rounded-lg border text-right cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-500 font-bold'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-3.5 h-3.5 rounded-full border shrink-0 flex items-center justify-center ${
                              isSelected ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300'
                            }`}
                          >
                            {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                          </span>
                          <span className="text-xs text-slate-900 truncate">{it?.name || 'صنف'}</span>
                        </div>
                        <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded shrink-0">
                          المتبقي: {remBase} {un?.name || ''}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Quantity and Unit Row */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-700 font-bold mb-1">الكمية المستردة *</label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono text-xs font-black ${
                    isExceedingAllowed
                      ? 'border-rose-400 text-rose-700'
                      : 'border-slate-200 text-slate-900 focus:border-emerald-500'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">الوحدة *</label>
                <select
                  value={unitId}
                  onChange={(e) => setUnitId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-emerald-500"
                  required
                >
                  {itemUnits.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.factor !== 1 ? `(${u.factor})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-slate-700 font-bold mb-1">سبب الاسترداد *</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-emerald-500"
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
              <label className="block text-slate-700 font-bold mb-1">ملاحظات (اختياري)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ملاحظات الاستلام أو الإصلاح..."
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:border-emerald-500"
              />
            </div>

            {/* Simple Stock Preview */}
            {selectedItem && (
              <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-[11px]">
                <span className="text-slate-600 font-medium">الرصيد بعد الإعادة:</span>
                <span className="font-mono font-bold text-emerald-700">
                  {currentStock} ➔ {projectedStock} {baseUnitName} (+{baseQty})
                </span>
              </div>
            )}

            {/* Buttons */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isExceedingAllowed || numQty <= 0 || !activeRecord}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs shadow-xs transition cursor-pointer"
              >
                <PackageCheck className="w-4 h-4" />
                <span>{isSubmitting ? 'جاري الحفظ...' : 'تأكيد العودة للمخزون'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
