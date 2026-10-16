import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  ChevronDown,
  Package,
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
  
  // Combobox dropdown search & open state
  const [searchQuery, setSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Active items (not deleted)
  const activeItems = useMemo(() => {
    return items.filter((i) => !i.isDeleted && !i.isArchived);
  }, [items]);

  // Filtered items for combobox search
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

  // When item changes, default to base unit & close dropdown
  const handleItemSelect = (item: Item) => {
    setSelectedItemId(item.id);
    setSelectedUnitId(item.baseUnitId);
    setSearchQuery('');
    setIsDropdownOpen(false);
    setFormError(null);
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
    if (isSubmitting) return;
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
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-white/80 transition cursor-pointer"
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

          {/* Custom Searchable Dropdown / Combobox for Item Selection */}
          <div className="space-y-1.5 relative" ref={dropdownRef}>
            <label className="block text-xs font-bold text-slate-700">
              اختر الصنف <span className="text-rose-500">*</span>
            </label>

            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-3.5 py-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-right transition cursor-pointer"
              >
                {selectedItem ? (
                  <div className="flex items-center justify-between w-full min-w-0">
                    <div className="truncate">
                      <span className="font-bold text-slate-900 text-xs sm:text-sm block truncate">
                        {selectedItem.name}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {selectedItem.code} • الرصيد: {currentStock} {baseUnitObj?.name || 'وحدة'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-slate-400 text-xs">
                    <Package className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>ابحث أو اختر الصنف من القائمة...</span>
                  </div>
                )}
                <ChevronDown className="w-4 h-4 text-slate-400 shrink-0 mr-2" />
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-72">
                  {/* Search Input inside dropdown */}
                  <div className="p-2.5 border-b border-slate-800 bg-slate-950">
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="ابحث بالاسم، رمز SKU، أو الباركود..."
                        className="w-full pr-9 pl-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 outline-hidden font-medium"
                      />
                    </div>
                  </div>

                  {/* Options List */}
                  <div className="overflow-y-auto p-1.5 space-y-1">
                    {filteredItems.length === 0 ? (
                      <div className="p-4 text-center text-xs text-slate-400">
                        لا توجد أصناف مطابقة للبحث
                      </div>
                    ) : (
                      filteredItems.map((item) => {
                        const stock = getItemStock(item.id);
                        const bUnit = units.find((u) => u.id === item.baseUnitId)?.name || 'وحدة';
                        const isSelected = item.id === selectedItemId;

                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => handleItemSelect(item)}
                            className={`w-full flex items-center justify-between p-2.5 rounded-xl text-right transition cursor-pointer ${
                              isSelected
                                ? 'bg-emerald-600/20 border border-emerald-500/40 text-white'
                                : 'hover:bg-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="font-bold text-xs truncate">{item.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                {item.code}
                              </div>
                            </div>
                            <div className="text-left shrink-0 mr-2">
                              <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-lg ${
                                stock > 0 ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60' : 'bg-rose-950 text-rose-300 border border-rose-800/60'
                              }`}>
                                {stock} {bUnit}
                              </span>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
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
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                الوحدة المستخدمة <span className="text-rose-500">*</span>
              </label>
              <select
                value={selectedUnitId}
                onChange={(e) => setSelectedUnitId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
                required
              >
                {availableUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                الكمية ({currentUnitInfo.name}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0.001"
                placeholder="أدخل الكمية..."
                value={quantity}
                onChange={(e) => {
                  const val = e.target.value;
                  setQuantity(val === '' ? '' : parseFloat(val));
                  setFormError(null);
                }}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900 bg-white"
                required
              />
            </div>
          </div>

          {/* Real-time Calculation Summary */}
          {selectedItem && numQty > 0 && (
            <div className="p-3.5 bg-slate-900 text-white rounded-2xl text-xs space-y-1.5">
              <div className="flex items-center justify-between text-slate-300">
                <span>المعادل بالوحدة الأساسية ({baseUnitObj?.name || 'وحدة'}):</span>
                <span className="font-mono font-bold text-emerald-400">
                  {baseQty} {baseUnitObj?.name || 'وحدة'}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-slate-800">
                <span>الرصيد المتوقع بعد العملية:</span>
                <span
                  className={`font-mono font-bold ${
                    remainingStockAfterOperation < 0 ? 'text-rose-400' : 'text-white'
                  }`}
                >
                  {remainingStockAfterOperation} {baseUnitObj?.name || 'وحدة'}
                </span>
              </div>

              {isExceedingStock && (
                <div className="pt-1 text-rose-400 font-bold flex items-center gap-1">
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
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedItemId || !numQty || (isOut && (isOutOfStock || isExceedingStock))}
              className={`px-5 py-2.5 rounded-xl text-white text-xs font-black transition flex items-center gap-2 shadow-sm disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${
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
