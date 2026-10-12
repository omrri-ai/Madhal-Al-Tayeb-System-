import React, { useState, useEffect, useMemo } from 'react';
import { X, ArrowDownLeft, ArrowUpRight, AlertCircle, CheckCircle2, Calculator, HelpCircle, ChevronDown, Package } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { MovementType, StockMovement } from '../../types/inventory';
import { ItemPickerBottomSheet } from '../common/ItemPickerBottomSheet';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: MovementType;
  preselectedItemId?: string;
  editingMovement?: StockMovement | null;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'IN',
  preselectedItemId,
  editingMovement,
}) => {
  const { items, units, getItemStock, addMovement, updateMovement, showToast } = useInventory();

  const activeItems = useMemo(
    () => items.filter((i) => !i.isDeleted && !i.isArchived),
    [items]
  );

  const [type, setType] = useState<MovementType>(defaultType);
  const [itemId, setItemId] = useState<string>(preselectedItemId || '');
  const [isItemPickerOpen, setIsItemPickerOpen] = useState(false);
  const [unitId, setUnitId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [date, setDate] = useState<string>(new Date().toISOString().substring(0, 16));
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Sync state when editing or opening
  useEffect(() => {
    if (editingMovement) {
      setType(editingMovement.type);
      setItemId(editingMovement.itemId);
      setUnitId(editingMovement.unitId);
      setQuantity(editingMovement.quantity.toString());
      setDate(
        editingMovement.date
          ? new Date(editingMovement.date).toISOString().substring(0, 16)
          : new Date().toISOString().substring(0, 16)
      );
      setReferenceNumber(editingMovement.referenceNumber || '');
      setNotes(editingMovement.notes || '');
      setErrorMsg('');
    } else {
      setType(defaultType);
      const chosenItem = preselectedItemId || (activeItems.length > 0 ? activeItems[0].id : '');
      setItemId(chosenItem);
      setQuantity('1');
      setDate(new Date().toISOString().substring(0, 16));
      setReferenceNumber('');
      setNotes('');
      setErrorMsg('');
    }
  }, [isOpen, editingMovement, defaultType, preselectedItemId, activeItems]);

  const selectedItem = useMemo(() => {
    return items.find((i) => i.id === itemId);
  }, [items, itemId]);

  // Set default unit when item changes
  useEffect(() => {
    if (selectedItem) {
      if (!unitId || (!selectedItem.conversions.some((c) => c.unitId === unitId) && selectedItem.baseUnitId !== unitId)) {
        setUnitId(selectedItem.baseUnitId);
      }
    }
  }, [selectedItem, unitId]);

  // Available units for the selected item (Base Unit + Configured Conversions only)
  const availableUnits = useMemo(() => {
    if (!selectedItem) return [];

    const list: { id: string; name: string; isBase: boolean; factor: number; label: string }[] = [];
    const baseU = units.find((u) => u.id === selectedItem.baseUnitId);
    if (baseU) {
      list.push({
        id: baseU.id,
        name: baseU.name,
        isBase: true,
        factor: 1,
        label: `${baseU.name} (الوحدة الأساسية)`,
      });
    }

    for (const conv of selectedItem.conversions) {
      const u = units.find((unit) => unit.id === conv.unitId);
      if (u) {
        list.push({
          id: u.id,
          name: u.name,
          isBase: false,
          factor: conv.factorToBase,
          label: `${u.name} (1 ${u.name} = ${conv.factorToBase} ${baseU?.name || 'وحدة'})`,
        });
      }
    }

    return list;
  }, [selectedItem, units]);

  // Current selected unit info
  const currentUnitInfo = useMemo(() => {
    return availableUnits.find((u) => u.id === unitId) || availableUnits[0];
  }, [availableUnits, unitId]);

  const factor = currentUnitInfo ? currentUnitInfo.factor : 1;
  const numQuantity = parseFloat(quantity) || 0;
  const baseQuantity = Math.round(numQuantity * factor * 1000) / 1000;

  // Stock calculation & validations
  const currentStock = selectedItem ? getItemStock(selectedItem.id) : 0;
  const baseUnitName = units.find((u) => u.id === selectedItem?.baseUnitId)?.name || 'وحدة';

  // For OUT movements or edit validations
  const resultingStock = useMemo(() => {
    if (!selectedItem) return 0;
    if (editingMovement) {
      // Revert editing movement first
      let base = currentStock;
      if (editingMovement.type === 'IN') base -= editingMovement.baseQuantity;
      if (editingMovement.type === 'OUT') base += editingMovement.baseQuantity;

      // Apply new
      if (type === 'IN') return base + baseQuantity;
      return base - baseQuantity;
    }

    if (type === 'IN') return currentStock + baseQuantity;
    return currentStock - baseQuantity;
  }, [selectedItem, editingMovement, currentStock, type, baseQuantity]);

  const isInsufficientStock = type === 'OUT' && resultingStock < 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!itemId) {
      setErrorMsg('يرجى اختيار الصنف أولاً');
      return;
    }

    if (!unitId) {
      setErrorMsg('يرجى اختيار الوحدة');
      return;
    }

    if (numQuantity <= 0) {
      setErrorMsg('يرجى إدخال كمية صحيحة أكبر من الصفر');
      return;
    }

    if (isInsufficientStock) {
      setErrorMsg(
        `لا يمكن إتمام عملية الصرف: الكمية المطلوبة (${numQuantity} ${currentUnitInfo?.name || ''} = ${baseQuantity} ${baseUnitName}) تتجاوز الرصيد المتاح حالياً (${currentStock} ${baseUnitName}).`
      );
      return;
    }

    if (editingMovement) {
      const res = updateMovement(editingMovement.id, {
        unitId,
        quantity: numQuantity,
        type,
        date: new Date(date).toISOString(),
        referenceNumber,
        notes,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'حدث خطأ أثناء تعديل الحركة');
        return;
      }
    } else {
      const res = addMovement({
        itemId,
        type,
        unitId,
        quantity: numQuantity,
        date: new Date(date).toISOString(),
        referenceNumber,
        notes,
      });

      if (!res.success) {
        setErrorMsg(res.error || 'حدث خطأ أثناء تسجيل الحركة');
        return;
      }
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 my-8 text-right">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                type === 'IN' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}
            >
              {type === 'IN' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {editingMovement ? 'تعديل حركة مخزنية' : type === 'IN' ? 'تسجيل وارد (دخول مخزون)' : 'تسجيل صادر (خروج مخزون)'}
              </h3>
              <p className="text-xs text-slate-500">
                {type === 'IN' ? 'إضافة كميات واردة إلى الرصيد' : 'صرف كميات وتخفيض الرصيد مع التحقق'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Movement Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">نوع الحركة</label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setType('IN')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  type === 'IN'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowDownLeft className="w-4 h-4" />
                <span>دخول / وارد (+)</span>
              </button>
              <button
                type="button"
                onClick={() => setType('OUT')}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-bold transition-all cursor-pointer ${
                  type === 'OUT'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowUpRight className="w-4 h-4" />
                <span>خروج / صادر (-)</span>
              </button>
            </div>
          </div>

          {/* Custom Item Picker Trigger */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              الصنف <span className="text-rose-500">*</span>
            </label>
            {editingMovement ? (
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-right">
                <div className="text-sm font-bold text-slate-900">{selectedItem?.name}</div>
                <div className="flex items-center gap-2 mt-1">
                  <span dir="ltr" className="text-xs text-slate-500 font-mono">
                    {selectedItem?.code}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs text-slate-600">
                    الرصيد: {currentStock} {baseUnitName}
                  </span>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsItemPickerOpen(true)}
                className="w-full text-right p-3.5 bg-slate-50 hover:bg-white border border-slate-200 hover:border-emerald-500 rounded-xl transition-all flex items-center justify-between gap-3 group focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-500 cursor-pointer shadow-2xs"
              >
                {selectedItem ? (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                      {selectedItem.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span dir="ltr" className="text-xs text-slate-500 font-mono inline-block">
                        {selectedItem.code}
                      </span>
                      <span className="text-slate-300">•</span>
                      <span
                        className={`text-xs font-semibold ${
                          currentStock > 0 ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        الرصيد: {currentStock} {baseUnitName}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400 text-sm">
                    <Package className="w-4 h-4 text-slate-400" />
                    <span>اضغط لاختيار الصنف...</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200/80 group-hover:bg-emerald-100 transition-colors">
                    {selectedItem ? 'تغيير' : 'اختيار'}
                  </span>
                  <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                </div>
              </button>
            )}
            {activeItems.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                لا توجد أصناف نشطة حالياً. يرجى إضافة صنف أولاً من شاشة الأصناف.
              </p>
            )}
          </div>

          {/* Unit & Quantity Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Unit */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                الوحدة المستخدمة في الحركة <span className="text-rose-500">*</span>
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                required
                disabled={availableUnits.length === 0}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors disabled:opacity-60"
              >
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
              {selectedItem && selectedItem.conversions.length === 0 && (
                <p className="text-[11px] text-slate-400 mt-1">
                  هذا الصنف ليس لديه تحويلات مخصصة (يعتمد فقط على {baseUnitName}).
                </p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                الكمية ({currentUnitInfo?.name || 'الوحدة'}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setErrorMsg('');
                }}
                required
                placeholder="أدخل الكمية"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-bold focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors"
              />
            </div>
          </div>

          {/* Interactive Conversion & Balance Status Card */}
          {selectedItem && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-1.5 font-medium">
                  <Calculator className="w-4 h-4 text-slate-400" />
                  معادل الكمية بالوحدة الأساسية:
                </span>
                <span className="font-bold text-slate-900 font-mono">
                  {baseQuantity} {baseUnitName}
                </span>
              </div>

              {factor > 1 && (
                <div className="text-[11px] text-slate-500 bg-white/80 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                  <span>
                    حساب التحويل المخصص: ({numQuantity} {currentUnitInfo?.name} × {factor})
                  </span>
                  <span className="font-semibold text-slate-700">
                    = {baseQuantity} {baseUnitName}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs">
                <span className="text-slate-600">الرصيد الحالي المتوفر:</span>
                <span className="font-bold text-slate-800">
                  {currentStock} {baseUnitName}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs font-bold">
                <span className={type === 'OUT' && resultingStock < 0 ? 'text-rose-600' : 'text-slate-700'}>
                  الرصيد بعد تنفيذ الحركة:
                </span>
                <span
                  className={`font-mono text-sm ${
                    type === 'OUT' && resultingStock < 0
                      ? 'text-rose-600 font-black'
                      : resultingStock === 0
                      ? 'text-amber-600'
                      : 'text-emerald-700'
                  }`}
                >
                  {resultingStock} {baseUnitName}
                </span>
              </div>

              {isInsufficientStock && (
                <div className="mt-2 p-2 rounded-lg bg-rose-100/80 border border-rose-300 text-rose-800 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>تنبيه: الكمية المطلوبة تتجاوز الرصيد المتوفر بمقدار {Math.abs(resultingStock)} {baseUnitName}!</span>
                </div>
              )}
            </div>
          )}

          {/* Date & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">التاريخ والوقت</label>
              <input
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                رقم الإذن / الفاتورة (اختياري)
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="مثال: فاتورة 1024 أو إذن 88"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">ملاحظات إضافية (اختياري)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: توريد من المورد س / صرف لقسم الإنتاج / بضاعة مستلمة..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:border-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              onClick={(e) => {
                if (isInsufficientStock) {
                  e.preventDefault();
                  const msg = `⚠️ لا يمكن إتمام عملية الخروج: الكمية المطلوبة (${numQuantity} ${currentUnitInfo?.name || ''} = ${baseQuantity} ${baseUnitName}) تتجاوز الرصيد المتوفر حالياً (${currentStock} ${baseUnitName}). يمنع النظام أي رصيد سالب نهائياً!`;
                  setErrorMsg(msg);
                  showToast(msg, 'error');
                }
              }}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-md transition-all cursor-pointer ${
                type === 'IN'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : isInsufficientStock
                  ? 'bg-rose-400 hover:bg-rose-500'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {type === 'IN' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              <span>{editingMovement ? 'حفظ التعديلات' : type === 'IN' ? 'تأكيد تسجيل الدخول' : 'تأكيد تسجيل الخروج'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Item Picker Bottom Sheet */}
      <ItemPickerBottomSheet
        isOpen={isItemPickerOpen}
        onClose={() => setIsItemPickerOpen(false)}
        selectedItemId={itemId}
        onSelectItem={(id) => {
          setItemId(id);
          setErrorMsg('');
        }}
        movementType={type}
        items={activeItems}
      />
    </div>
  );
};
