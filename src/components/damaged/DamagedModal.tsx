import React, { useState, useMemo } from 'react';
import { X, AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { DamagedSection, DamagedReason } from '../../types/inventory';

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

export const DamagedModal: React.FC<DamagedModalProps> = ({ isOpen, onClose }) => {
  const { items, units, categories, getItemStock, addDamagedRecord } = useInventory();

  const [section, setSection] = useState<DamagedSection>('GENERAL');
  const [itemId, setItemId] = useState('');
  const [unitId, setUnitId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [reason, setReason] = useState<DamagedReason | string>('تلف تخزين');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Active items filtered by section if needed (General vs Production)
  const availableItems = useMemo(() => {
    return items.filter((i) => {
      if (i.isArchived || i.isDeleted) return false;
      if (section === 'PRODUCTION') {
        return Boolean(i.isProductionItem);
      }
      return true; // General inventory includes all active items or non-production items
    });
  }, [items, section]);

  const selectedItem = useMemo(() => items.find((i) => i.id === itemId), [items, itemId]);
  const baseUnit = useMemo(() => units.find((u) => u.id === selectedItem?.baseUnitId), [units, selectedItem]);

  // Available units for the selected item
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

  // Set default unit when item changes
  React.useEffect(() => {
    if (selectedItem) {
      setUnitId(selectedItem.baseUnitId);
    } else {
      setUnitId('');
    }
  }, [selectedItem]);

  const currentStock = useMemo(() => {
    if (!selectedItem) return 0;
    return getItemStock(selectedItem.id);
  }, [selectedItem, getItemStock]);

  const selectedUnitFactor = useMemo(() => {
    const found = itemUnits.find((u) => u.id === unitId);
    return found ? found.factor : 1;
  }, [itemUnits, unitId]);

  const numQty = typeof quantity === 'number' ? quantity : 0;
  const baseQty = Math.round(numQty * selectedUnitFactor * 1000) / 1000;
  const isExceeding = baseQty > currentStock;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!itemId) {
      setErrorMsg('يرجى اختيار الصنف التالف.');
      return;
    }
    if (!numQty || numQty <= 0) {
      setErrorMsg('يرجى إدخال كمية تالفة صحيحة أكبر من الصفر.');
      return;
    }
    if (isExceeding) {
      setErrorMsg(`عفواً، الكمية المطلوبة (${baseQty}) تتجاوز الرصيد المتوفر حالياً (${currentStock}).`);
      return;
    }

    setIsSubmitting(true);
    const res = await addDamagedRecord({
      section,
      itemId,
      unitId: unitId || selectedItem?.baseUnitId || '',
      quantity: numQty,
      reason,
      notes,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMsg(res.error || 'حدث خطأ أثناء تسجيل التالف');
      return;
    }

    // Reset & close
    setItemId('');
    setQuantity('');
    setNotes('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 my-8 text-right">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900">تسجيل صنف تالف جديد</h3>
              <p className="text-xs text-slate-500">خصم الكميات التالفة من الرصيد بدقة تامة</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-bold flex items-center gap-2 animate-shake">
            <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Section Selection */}
          <div>
            <label className="block text-slate-700 font-bold mb-1.5">القسم المستهدف *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setSection('GENERAL')}
                className={`py-2.5 px-4 rounded-xl font-bold border transition-all cursor-pointer ${
                  section === 'GENERAL'
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                المخزون العام
              </button>
              <button
                type="button"
                onClick={() => setSection('PRODUCTION')}
                className={`py-2.5 px-4 rounded-xl font-bold border transition-all cursor-pointer ${
                  section === 'PRODUCTION'
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                الإنتاج والتصنيع
              </button>
            </div>
          </div>

          {/* Item Selection */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">اختر الصنف *</label>
            <select
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 font-medium text-slate-900"
              required
            >
              <option value="">-- اختر الصنف من القائمة --</option>
              {availableItems.map((item) => {
                const cat = categories.find((c) => c.id === item.categoryId);
                const stock = getItemStock(item.id);
                const bUnit = units.find((u) => u.id === item.baseUnitId);
                return (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code}) {cat ? `[${cat.name}]` : ''} - الرصيد: {stock} {bUnit?.name || 'وحدة'}
                  </option>
                );
              })}
            </select>
          </div>

          {selectedItem && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-slate-500 block text-[11px]">الرصيد المتوفر حالياً:</span>
                <span className="font-black font-mono text-slate-900 text-sm">
                  {currentStock} {baseUnit?.name || 'وحدة'}
                </span>
              </div>
              <div className="text-left">
                <span className="text-slate-500 block text-[11px]">رمز الصنف (SKU):</span>
                <span className="font-mono font-bold text-slate-700">{selectedItem.code}</span>
              </div>
            </div>
          )}

          {/* Unit & Quantity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-700 font-bold mb-1">وحدة القياس *</label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
                required
              >
                {itemUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-700 font-bold mb-1">الكمية التالفة *</label>
              <input
                type="number"
                step="any"
                min="0.001"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="0.00"
                className={`w-full px-3 py-2 bg-slate-50 border rounded-xl font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 ${
                  isExceeding
                    ? 'border-rose-500 focus:ring-rose-500/20 bg-rose-50/50'
                    : 'border-slate-200 focus:ring-amber-500/20 focus:border-amber-500'
                }`}
                required
              />
            </div>
          </div>

          {isExceeding && (
            <p className="text-rose-600 font-bold text-[11px]">
              ⚠️ الكمية المطلوبة ({baseQty}) تتجاوز الرصيد المتوفر ({currentStock})!
            </p>
          )}

          {/* Reason Selection */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">سبب التلف *</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900"
              required
            >
              {REASONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-700 font-bold mb-1">ملاحظات إضافية (اختياري)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="تفاصيل إضافية حول التلف..."
              rows={2}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isExceeding || !itemId}
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 text-white font-bold rounded-xl shadow-sm transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ وتسجيل التلف'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
