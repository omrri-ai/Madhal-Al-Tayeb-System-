import React, { useState, useMemo } from 'react';
import {
  X,
  ArrowUpRight,
  ArrowDownLeft,
  Search,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Layers,
  Scale,
  FileText,
  Loader2,
  Printer,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Item, StockMovement } from '../../types/inventory';

interface FactoryMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'MFG_OUT' | 'MFG_IN';
  onSuccess: (movement: StockMovement) => void;
}

export const FactoryMovementModal: React.FC<FactoryMovementModalProps> = ({
  isOpen,
  onClose,
  type,
  onSuccess,
}) => {
  const { items, units, categories, getItemStock, addFactoryMovement, generateFactoryReferenceNumber } =
    useInventory();

  const isOut = type === 'MFG_OUT';

  // Form states
  const [selectedItemId, setSelectedItemId] = useState('');
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Active items (not deleted)
  const activeItems = useMemo(() => {
    return items.filter((i) => !i.isDeleted && !i.isArchived);
  }, [items]);

  // Filtered items for picker
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return activeItems;
    const q = searchQuery.toLowerCase().trim();
    return activeItems.filter(
      (i) => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)
    );
  }, [activeItems, searchQuery]);

  // Selected item object
  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === selectedItemId);
  }, [items, selectedItemId]);

  // Available units for the selected item (base unit + conversions)
  const availableUnits = useMemo(() => {
    if (!selectedItem) return [];
    const baseU = units.find((u) => u.id === selectedItem.baseUnitId);
    const list: { id: string; name: string; factor: number; isBase: boolean }[] = [];

    if (baseU) {
      list.push({
        id: baseU.id,
        name: `${baseU.name} (الوحدة الأساسية)`,
        factor: 1,
        isBase: true,
      });
    }

    if (selectedItem.conversions && selectedItem.conversions.length > 0) {
      for (const conv of selectedItem.conversions) {
        const u = units.find((x) => x.id === conv.unitId);
        if (u) {
          list.push({
            id: u.id,
            name: `${u.name} (1 ${u.name} = ${conv.factorToBase} ${baseU?.name || 'وحدة'})`,
            factor: conv.factorToBase,
            isBase: false,
          });
        }
      }
    }

    return list;
  }, [selectedItem, units]);

  // When item changes, default to base unit
  const handleItemSelect = (itemId: string) => {
    setSelectedItemId(itemId);
    setFormError(null);
    const itm = items.find((i) => i.id === itemId);
    if (itm) {
      setSelectedUnitId(itm.baseUnitId);
    }
  };

  // Base unit of selected item
  const baseUnitObj = useMemo(() => {
    if (!selectedItem) return null;
    return units.find((u) => u.id === selectedItem.baseUnitId);
  }, [selectedItem, units]);

  // Selected unit object & factor
  const currentUnitInfo = useMemo(() => {
    if (!selectedItem || !selectedUnitId) return { factor: 1, name: 'وحدة' };
    const found = availableUnits.find((u) => u.id === selectedUnitId);
    const uObj = units.find((u) => u.id === selectedUnitId);
    return {
      factor: found ? found.factor : 1,
      name: uObj?.name || 'وحدة',
    };
  }, [selectedItem, selectedUnitId, availableUnits, units]);

  // Real-time stock for selected item
  const currentStock = useMemo(() => {
    if (!selectedItem) return 0;
    return getItemStock(selectedItem.id);
  }, [selectedItem, getItemStock]);

  // Calculated base quantity
  const numQty = typeof quantity === 'number' ? quantity : 0;
  const baseQty = Math.round(numQty * currentUnitInfo.factor * 1000) / 1000;

  // Validation
  const isOutOfStock = isOut && selectedItem && currentStock <= 0;
  const isExceedingStock = isOut && selectedItem && numQty > 0 && baseQty > currentStock;
  const remainingStockAfterOperation = isOut ? currentStock - baseQty : currentStock + baseQty;

  // Preview reference number
  const previewRefNumber = useMemo(() => {
    return generateFactoryReferenceNumber(type);
  }, [generateFactoryReferenceNumber, type]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!selectedItemId) {
      setFormError('يرجى اختيار الصنف أولاً للمتابعة.');
      return;
    }

    if (!numQty || numQty <= 0) {
      setFormError('يرجى إدخال كمية صحيحة أكبر من الصفر.');
      return;
    }

    if (!selectedUnitId) {
      setFormError('يرجى اختيار الوحدة.');
      return;
    }

    if (isOut && baseQty > currentStock) {
      setFormError(
        `عفواً، الكمية المطلوبة للخروج (${numQty} ${currentUnitInfo.name} = ${baseQty} ${baseUnitObj?.name || 'وحدة'}) تتجاوز الرصيد المتوفر حالياً (${currentStock} ${baseUnitObj?.name || 'وحدة'}). يمنع النظام تماماً الأرصدة السالبة!`
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await addFactoryMovement({
        itemId: selectedItemId,
        type,
        unitId: selectedUnitId,
        quantity: numQty,
        date,
        notes,
      });

      if (res.success && res.movement) {
        onSuccess(res.movement);
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
      <div className="relative bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div
          className={`p-5 border-b border-slate-200 flex items-center justify-between ${
            isOut ? 'bg-rose-50/70' : 'bg-emerald-50/70'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-11 h-11 rounded-2xl flex items-center justify-center shadow-xs ${
                isOut ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
              }`}
            >
              {isOut ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownLeft className="w-6 h-6" />}
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">
                {isOut ? 'خروج مواد للمصنع' : 'وارد بضاعة من المصنع'}
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                {isOut
                  ? 'صرف مواد وخصم الكمية فوراً من رصيد المستودع'
                  : 'استلام بضاعة وإضافة الكمية فوراً إلى رصيد المستودع'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white/80 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 overflow-y-auto space-y-5">
          {/* Form Error Banner */}
          {formError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="font-medium leading-relaxed">{formError}</div>
            </div>
          )}

          {/* Reference Preview Badge */}
          <div className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
            <span className="text-slate-500 font-medium">رقم السند التلقائي:</span>
            <span className="font-mono font-black text-slate-800 px-2.5 py-1 bg-white border border-slate-200 rounded-lg shadow-2xs">
              {previewRefNumber}
            </span>
          </div>

          {/* Item Selection */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              اختر الصنف <span className="text-rose-500">*</span>
            </label>

            {/* Quick Search */}
            <div className="relative mb-2">
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="ابحث بالاسم أو الرمز..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-9 pl-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-slate-50/50"
              />
            </div>

            <select
              value={selectedItemId}
              onChange={(e) => handleItemSelect(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
              required
            >
              <option value="">-- اضغط لاختيار الصنف من القائمة --</option>
              {filteredItems.map((item) => {
                const stock = getItemStock(item.id);
                const bUnit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
                return (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code}) — الرصيد: {stock} {bUnit}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Selected Item Stock Card */}
          {selectedItem && (
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-2 transition ${
                isOut && isOutOfStock
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-slate-50 border-slate-200 text-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-600">الرصيد المتوفر حالياً بالمستودع:</span>
                <span
                  className={`font-mono text-sm font-black px-2 py-0.5 rounded-md ${
                    currentStock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}
                >
                  {currentStock} {baseUnitObj?.name || 'وحدة'}
                </span>
              </div>

              {isOut && isOutOfStock && (
                <div className="flex items-center gap-1.5 text-rose-700 font-bold text-xs pt-1">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>تنبيه: هذا الصنف غير متوفر بالمستودع حالياً (رصيده صفر). لا يمكن صرفه!</span>
                </div>
              )}
            </div>
          )}

          {/* Unit & Quantity Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Unit */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                الوحدة المستخدمة <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                disabled={!selectedItem}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white disabled:bg-slate-100 disabled:text-slate-400"
                required
              >
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                الكمية <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                placeholder="أدخل الكمية..."
                value={quantity}
                onChange={(e) => setQuantity(e.target.value === '' ? '' : Number(e.target.value))}
                disabled={!selectedItem || (isOut && isOutOfStock)}
                className={`w-full px-3 py-2.5 rounded-xl border text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white ${
                  isExceedingStock ? 'border-rose-400 ring-1 ring-rose-400 bg-rose-50/30' : 'border-slate-200'
                }`}
                required
              />
            </div>
          </div>

          {/* Base Equivalent & Stock Preview */}
          {selectedItem && numQty > 0 && (
            <div
              className={`p-3.5 rounded-2xl border text-xs space-y-1.5 ${
                isExceedingStock
                  ? 'bg-rose-50 border-rose-300 text-rose-900'
                  : 'bg-blue-50/60 border-blue-200 text-blue-900'
              }`}
            >
              <div className="flex justify-between items-center">
                <span>المعادل بالوحدة الأساسية:</span>
                <span className="font-mono font-bold">
                  {baseQty} {baseUnitObj?.name || 'وحدة'}
                </span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-200/60 pt-1.5">
                <span>الرصيد المتوقع بعد العملية:</span>
                <span
                  className={`font-mono font-bold ${
                    remainingStockAfterOperation < 0 ? 'text-rose-700' : 'text-slate-800'
                  }`}
                >
                  {remainingStockAfterOperation} {baseUnitObj?.name || 'وحدة'}
                </span>
              </div>

              {isExceedingStock && (
                <div className="pt-1 text-rose-700 font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>الكمية تتجاوز الرصيد المتوفر! يمنع النظام الحركات السالبة.</span>
                </div>
              )}
            </div>
          )}

          {/* Date & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">التاريخ</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pr-9 pl-3 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">ملاحظات (اختياري)</label>
              <input
                type="text"
                placeholder="مثلاً: اسم المستلم أو رقم التشغيلة..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedItemId || !numQty || (isOut && (isOutOfStock || isExceedingStock))}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-black transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                isOut ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>جاري تسجيل الحركة وتحديث المخزون...</span>
                </>
              ) : (
                <>
                  {isOut ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownLeft className="w-4 h-4" />}
                  <span>{isOut ? 'تأكيد الخروج وخصم من المخزون' : 'تأكيد الوارد وإضافة للمخزون'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
