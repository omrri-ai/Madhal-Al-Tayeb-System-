import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Plus,
  Trash2,
  FolderPlus,
  Scale,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Check,
  CheckCircle2,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Item, UnitConversion } from '../../types/inventory';

interface ItemFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem?: Item | null;
}

export const ItemFormModal: React.FC<ItemFormModalProps> = ({
  isOpen,
  onClose,
  editingItem,
}) => {
  const {
    items,
    categories,
    units,
    movements,
    addItem,
    updateItem,
    addCategory,
    addUnit,
    showToast,
  } = useInventory();

  // Find live item from inventory items to ensure we always have freshest data even after updates
  const currentItem = useMemo(() => {
    if (!editingItem) return null;
    return items.find((i) => i.id === editingItem.id) || editingItem;
  }, [editingItem, items]);

  const hasMovements = useMemo(() => {
    if (!currentItem) return false;
    return movements.some((m) => m.itemId === currentItem.id);
  }, [currentItem, movements]);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [baseUnitId, setBaseUnitId] = useState('');
  const [conversions, setConversions] = useState<UnitConversion[]>([]);
  const [minStockAlert, setMinStockAlert] = useState('0');
  const [costPrice, setCostPrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [notes, setNotes] = useState('');
  const [editReason, setEditReason] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Inline Category Creator
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Inline Unit Creator
  const [showNewUnitInput, setShowNewUnitInput] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  // Real-time duplicate checks (excluding current item and deleted items)
  const isDuplicateName = useMemo(() => {
    const clean = (name || '').trim().toLowerCase();
    if (!clean) return false;
    if (currentItem && (currentItem.name || '').trim().toLowerCase() === clean) {
      return false;
    }
    return items.some(
      (i) => i.id !== currentItem?.id && !i.isDeleted && (i?.name || '').trim().toLowerCase() === clean
    );
  }, [name, items, currentItem]);

  const isDuplicateCode = useMemo(() => {
    const clean = (code || '').trim().toLowerCase();
    if (!clean) return false;
    if (currentItem && (currentItem.code || '').trim().toLowerCase() === clean) {
      return false;
    }
    return items.some(
      (i) => i.id !== currentItem?.id && !i.isDeleted && (i?.code || '').trim().toLowerCase() === clean
    );
  }, [code, items, currentItem]);

  // Compute next code based on all registered items in the system (including archived and trash, but excluding permanently deleted items)
  const computeNextCode = useCallback((): string => {
    if (!items || items.length === 0) return 'ITM-0001';

    let maxNum = 0;
    let preferredPrefix = 'ITM-';
    let padLength = 4;

    for (const item of items) {
      if (!item || !item.code) continue;
      const match = item.code.match(/^(.*?)(\d+)$/);
      if (match) {
        const prefix = match[1];
        const numStr = match[2];
        const num = parseInt(numStr, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
          preferredPrefix = prefix;
          padLength = Math.max(padLength, numStr.length);
        }
      } else {
        const generalMatch = item.code.match(/(\d+)/);
        if (generalMatch) {
          const num = parseInt(generalMatch[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    }

    const nextNum = maxNum + 1;
    return `${preferredPrefix}${nextNum.toString().padStart(padLength, '0')}`;
  }, [items]);

  // Populate or reset form
  useEffect(() => {
    if (!isOpen) return;

    if (currentItem) {
      setName(currentItem.name || '');
      setCode(currentItem.code || '');
      setCategoryId(currentItem.categoryId || '');
      setBaseUnitId(currentItem.baseUnitId || '');
      setConversions(currentItem.conversions ? JSON.parse(JSON.stringify(currentItem.conversions)) : []);
      setMinStockAlert(currentItem.minStockAlert != null ? String(currentItem.minStockAlert) : '0');
      setCostPrice(currentItem.costPrice != null ? String(currentItem.costPrice) : '');
      setSalePrice(currentItem.salePrice != null ? String(currentItem.salePrice) : '');
      setNotes(currentItem.notes || '');
      setEditReason('');
      setErrorMsg('');
    } else {
      // New Item defaults: calculated from max existing code in active & archive
      setName('');
      setCode(computeNextCode());
      setCategoryId(categories.length > 0 ? categories[0].id : '');
      const habbaUnit = units.find((u) => (u?.name || '').trim() === 'حبة');
      setBaseUnitId(habbaUnit ? habbaUnit.id : (units.length > 0 ? units[0].id : ''));
      setConversions([]);
      setMinStockAlert('5');
      setCostPrice('');
      setSalePrice('');
      setNotes('');
      setEditReason('');
      setErrorMsg('');
    }
    setShowNewCatInput(false);
    setShowNewUnitInput(false);
    setNewCatName('');
    setNewUnitName('');
  }, [isOpen, currentItem, categories, units, computeNextCode]);

  // Ensure default base unit is 'حبة' when adding a new item
  useEffect(() => {
    if (!currentItem && isOpen && units.length > 0) {
      if (!baseUnitId || !units.some((u) => u.id === baseUnitId)) {
        const habbaUnit = units.find((u) => (u?.name || '').trim() === 'حبة');
        setBaseUnitId(habbaUnit ? habbaUnit.id : units[0].id);
      }
    }
  }, [isOpen, currentItem, units, baseUnitId]);

  const baseUnitName = useMemo(() => {
    return units.find((u) => u.id === baseUnitId)?.name || 'الوحدة الأساسية';
  }, [units, baseUnitId]);

  // Available units that can be added as conversions (not the base unit)
  const availableConversionUnits = useMemo(() => {
    return units.filter((u) => u.id !== baseUnitId);
  }, [units, baseUnitId]);

  // Quick Inline Category Creation
  const handleCreateCategoryInline = () => {
    if (!newCatName.trim()) return;
    const res = addCategory(newCatName.trim());
    if (res.success && res.category) {
      setCategoryId(res.category.id);
      setNewCatName('');
      setShowNewCatInput(false);
    } else {
      setErrorMsg(res.error || 'فشل إنشاء القسم');
    }
  };

  // Quick Inline Unit Creation
  const handleCreateUnitInline = () => {
    if (!newUnitName.trim()) return;
    const res = addUnit(newUnitName.trim());
    if (res.success && res.unit) {
      // If no base unit yet, select it
      if (!baseUnitId) {
        setBaseUnitId(res.unit.id);
      }
      setNewUnitName('');
      setShowNewUnitInput(false);
    } else {
      setErrorMsg(res.error || 'فشل إنشاء الوحدة');
    }
  };

  // Smart suggested factors for units
  const getSuggestedFactor = (targetUnitId: string, currentBaseUnitId: string): number | '' => {
    const targetUnit = units.find((u) => u.id === targetUnitId)?.name.trim();
    const baseUnit = units.find((u) => u.id === currentBaseUnitId)?.name.trim();
    if (!targetUnit || !baseUnit) return '';

    // كرتون مو محدد كم على حسب اكتب الكمية بداخل الكرتون
    if (targetUnit === 'كرتون') {
      return '';
    }

    // درزن = 12 حبة
    if (targetUnit === 'درزن' && (baseUnit === 'حبة' || baseUnit === 'قطعة')) {
      return 12;
    }

    // كيلوا 1000 جرام، نص 500، ربع 250، ثمن 125 جرام
    if (baseUnit === 'جرام' || baseUnit === 'غرام') {
      if (targetUnit === 'كيلو' || targetUnit === 'كيلوا') return 1000;
      if (targetUnit === 'نص') return 500;
      if (targetUnit === 'ربع') return 250;
      if (targetUnit === 'ثمن') return 125;
    }

    // إذا كانت الوحدة الأساسية كيلو
    if (baseUnit === 'كيلو' || baseUnit === 'كيلوا') {
      if (targetUnit === 'نص') return 0.5;
      if (targetUnit === 'ربع') return 0.25;
      if (targetUnit === 'ثمن') return 0.125;
      if (targetUnit === 'جرام' || targetUnit === 'غرام') return 0.001;
    }

    return '';
  };

  // Conversions logic
  const handleAddConversion = () => {
    // Find first unit not in conversions and not base unit
    const usedUnitIds = new Set(conversions.map((c) => c.unitId));
    const nextUnit = availableConversionUnits.find((u) => !usedUnitIds.has(u.id));

    if (!nextUnit) {
      showToast('لا توجد وحدات إضافية متاحة للتحويل. أضف وحدة جديدة أولاً.', 'info');
      return;
    }

    const suggested = getSuggestedFactor(nextUnit.id, baseUnitId);

    setConversions([
      ...conversions,
      {
        unitId: nextUnit.id,
        factorToBase: typeof suggested === 'number' ? suggested : (0 as any),
      },
    ]);
  };

  const handleUpdateConversion = (index: number, field: 'unitId' | 'factorToBase', val: any) => {
    const updated = [...conversions];
    if (field === 'unitId') {
      const suggested = getSuggestedFactor(val, baseUnitId);
      updated[index] = {
        ...updated[index],
        unitId: val,
        factorToBase: typeof suggested === 'number' ? suggested : (updated[index].factorToBase || 0),
      };
    } else {
      updated[index] = {
        ...updated[index],
        factorToBase: parseFloat(val) || 0,
      };
    }
    setConversions(updated);
  };

  const handleRemoveConversion = (index: number) => {
    setConversions(conversions.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('يرجى إدخال اسم الصنف');
      return;
    }

    if (isDuplicateName) {
      setErrorMsg(`يوجد صنف مسجل مسبقاً بنفس الاسم "${name.trim()}". يرجى اختيار اسم غير مكرر.`);
      return;
    }

    if (isDuplicateCode) {
      setErrorMsg(`رمز أو رقم الصنف "${code.trim()}" مسجل مسبقاً لصنف آخر. يرجى اختيار رمز أو رقم غير مكرر.`);
      return;
    }

    if (!categoryId) {
      setErrorMsg('يرجى اختيار أو إنشاء قسم للصنف');
      return;
    }

    if (!baseUnitId) {
      setErrorMsg('يرجى اختيار الوحدة الأساسية للصنف');
      return;
    }

    // Verify conversions: no duplicates, factor > 0
    const seen = new Set<string>();
    for (const c of conversions) {
      if (c.unitId === baseUnitId) {
        setErrorMsg('لا يمكن إضافة الوحدة الأساسية ضمن جدول التحويلات الإضافية');
        return;
      }
      if (seen.has(c.unitId)) {
        const uName = units.find((u) => u.id === c.unitId)?.name || 'الوحدة';
        setErrorMsg(`الوحدة (${uName}) مكررة في جدول التحويلات. احذف السطر المكرر`);
        return;
      }
      seen.add(c.unitId);
      if (c.factorToBase <= 0) {
        setErrorMsg('يجب أن يكون معامل التحويل أكبر من الصفر');
        return;
      }
    }

    const payload = {
      code: code.trim() || `ITM-${(items.length + 1).toString().padStart(4, '0')}`,
      name: name.trim(),
      categoryId,
      baseUnitId,
      conversions,
      minStockAlert: parseFloat(minStockAlert) >= 0 ? parseFloat(minStockAlert) : 0,
      costPrice: costPrice ? parseFloat(costPrice) : undefined,
      salePrice: salePrice ? parseFloat(salePrice) : undefined,
      notes: notes.trim(),
    };

    if (currentItem) {
      const trimmedReason = editReason.trim();
      if (!trimmedReason) {
        setErrorMsg('كتابة سبب التعديل إلزامية لتوثيق تعديلات الصنف (كالاسم، حد التنبيه، القسم، أو الوصف).');
        return;
      }
      const res = updateItem(currentItem.id, payload, trimmedReason);
      if (!res.success) {
        setErrorMsg(res.error || 'حدث خطأ أثناء تعديل الصنف');
        return;
      }
    } else {
      const res = addItem(payload);
      if (!res.success) {
        setErrorMsg(res.error || 'حدث خطأ أثناء إضافة الصنف');
        return;
      }
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 my-8 text-right max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {currentItem ? 'تعديل بيانات الصنف والتحويلات' : 'إضافة صنف جديد'}
            </h3>
            <p className="text-xs text-slate-500">
              حدد اسم الصنف، وقسمه، والوحدة الأساسية ومعاملات التحويل المخصصة
            </p>
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
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-sm shrink-0">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="overflow-y-auto pr-1 pl-2 space-y-5 flex-1">
          {/* Main Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                اسم الصنف <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setErrorMsg('');
                }}
                placeholder="مثال: بسكويت شاي / شاي كرك / كابل شبكة..."
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-slate-900 text-sm font-medium focus:bg-white transition-colors ${
                  isDuplicateName
                    ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                    : 'border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
                }`}
              />
              {isDuplicateName && (
                <p className="text-[11px] text-rose-600 font-bold mt-1">
                  ⚠️ يوجد صنف مسجل مسبقاً بهذا الاسم؛ يرجى اختيار اسم غير مكرر.
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                رمز الصنف / الباركود (SKU)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="مثال: ITM-0001 أو 62810..."
                  className={`flex-1 px-3.5 py-2.5 bg-slate-50 border rounded-xl text-slate-900 text-sm font-mono focus:bg-white ${
                    isDuplicateCode
                      ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                      : 'border-slate-200 focus:border-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setCode(computeNextCode())}
                  title="توليد الرمز التسلسلي التالي تلقائياً"
                  className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                </button>
              </div>
              {isDuplicateCode && (
                <p className="text-[11px] text-rose-600 font-bold mt-1">
                  ⚠️ هذا الرمز أو الرقم مسجل مسبقاً لصنف آخر.
                </p>
              )}
            </div>
          </div>

          {/* Category Section with Quick-Add */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-bold text-slate-800">
                القسم <span className="text-rose-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowNewCatInput(!showNewCatInput)}
                className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5" />
                <span>{showNewCatInput ? 'إلغاء' : '+ إنشاء قسم جديد فوراً'}</span>
              </button>
            </div>

            {showNewCatInput ? (
              <div className="flex gap-2 mb-2 p-2.5 bg-white rounded-xl border border-emerald-300 shadow-xs animate-in fade-in duration-150">
                <input
                  type="text"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="اكتب اسم القسم الجديد..."
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleCreateCategoryInline}
                  disabled={!newCatName.trim()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>حفظ واختيار</span>
                </button>
              </div>
            ) : null}

            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors"
            >
              <option value="" disabled>
                -- اختر القسم --
              </option>
              {categoryId && !categories.some((c) => c.id === categoryId) && (
                <option value={categoryId}>
                  القسم الحالي المسجل للصنف
                </option>
              )}
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {categories.length === 0 && (
              <p className="text-xs text-amber-600 mt-1.5">
                لا يوجد أقسام بعد! اضغط على "+ إنشاء قسم جديد فوراً" بالأعلى لإنشاء أول قسم.
              </p>
            )}
          </div>

          {/* Base Unit Section */}
          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-xs font-bold text-slate-800">
                  الوحدة الأساسية للصنف <span className="text-rose-500">*</span>
                </label>
                <p className="text-[11px] text-slate-500">
                  هي أصغر وحدة يعتمد عليها الرصيد وحسابات المخزون (مثل: حبة، قطعة، كيلو)
                </p>
              </div>
              {!hasMovements && (
                <button
                  type="button"
                  onClick={() => setShowNewUnitInput(!showNewUnitInput)}
                  className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Scale className="w-3.5 h-3.5" />
                  <span>{showNewUnitInput ? 'إلغاء' : '+ وحدة جديدة'}</span>
                </button>
              )}
            </div>

            {!hasMovements && showNewUnitInput ? (
              <div className="flex gap-2 mb-2 p-2.5 bg-white rounded-xl border border-emerald-300 shadow-xs animate-in fade-in duration-150">
                <input
                  type="text"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  placeholder="اسم الوحدة الجديدة (مثال: حبة، قطعة، كرتون)..."
                  className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:border-emerald-500"
                />
                <button
                  type="button"
                  onClick={handleCreateUnitInline}
                  disabled={!newUnitName.trim()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>حفظ</span>
                </button>
              </div>
            ) : null}

            <select
              value={baseUnitId}
              onChange={(e) => setBaseUnitId(e.target.value)}
              disabled={hasMovements}
              required
              className={`w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 transition-colors ${
                hasMovements ? 'bg-slate-100 text-slate-500 cursor-not-allowed opacity-90' : ''
              }`}
            >
              <option value="" disabled>
                -- اختر الوحدة الأساسية --
              </option>
              {baseUnitId && !units.some((u) => u.id === baseUnitId) && (
                <option value={baseUnitId}>
                  الوحدة الأساسية الحالية للصنف
                </option>
              )}
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} {u.symbol ? `(${u.symbol})` : ''}
                </option>
              ))}
            </select>
            {hasMovements && (
              <p className="text-[11px] text-amber-800 mt-1.5 font-medium bg-amber-50 p-2 rounded-lg border border-amber-200">
                🔒 الوحدة الأساسية ثابتة لوجود حركات مخزنية مسجلة بهذا الصنف حفاظاً على سلامة الأرصدة. يمكنك تعديل باقي البيانات بحرية.
              </p>
            )}
          </div>

          {/* Unit Conversions - Requirement 5 */}
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-emerald-600" />
                  تحويلات الوحدات الخاصة بهذا الصنف
                </h4>
                <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                  حدد عدد وحدات ({baseUnitName}) في كل وحدة أكبر خاصة بهذا الصنف. لن يتم افتراض أي تحويل لم تحدده بنفسك.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddConversion}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ تحويل وحدة</span>
              </button>
            </div>

            {conversions.length === 0 ? (
              <div className="text-center py-4 px-3 bg-white/70 rounded-xl border border-dashed border-emerald-200 text-slate-500 text-xs">
                لا توجد وحدات تحويل مخصصة لهذا الصنف حالياً. يعتمد الصنف فقط على الوحدة الأساسية ({baseUnitName}).
                <br />
                <span className="text-[11px] text-slate-400">
                  (مثال: إذا كان الصنف يُباع أيضاً بالكرتون أو الشدة أو الدرزن، اضغط "+ تحويل وحدة" وحدد كم {baseUnitName} في الكرتون)
                </span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {conversions.map((conv, index) => {
                  const currentConvUnit = units.find((u) => u.id === conv.unitId);
                  return (
                    <div
                      key={index}
                      className="p-3 bg-white rounded-xl border border-emerald-100 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-bold text-slate-700 whitespace-nowrap">1</span>
                        <select
                          value={conv.unitId}
                          onChange={(e) => handleUpdateConversion(index, 'unitId', e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-bold focus:bg-white"
                        >
                          {availableConversionUnits.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                        <span className="font-bold text-slate-600 whitespace-nowrap">=</span>
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          value={conv.factorToBase || ''}
                          onChange={(e) => handleUpdateConversion(index, 'factorToBase', e.target.value)}
                          placeholder={currentConvUnit?.name === 'كرتون' ? 'سعة الكرتون' : 'العدد'}
                          className="w-28 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 font-bold font-mono focus:bg-white"
                        />
                        <span className="font-bold text-emerald-800 whitespace-nowrap">
                          {baseUnitName}
                        </span>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                        {currentConvUnit?.name === 'كرتون' ? (
                          <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
                            كرتون: اكتب الكمية بالداخل لهذا الصنف
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium">
                            (1 {currentConvUnit?.name || 'وحدة'} = {conv.factorToBase || 0} {baseUnitName})
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveConversion(index)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف هذا التحويل"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Stock Alert & Pricing */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                حد تنبيه نقص المخزون ({baseUnitName})
              </label>
              <input
                type="number"
                min="0"
                value={minStockAlert}
                onChange={(e) => setMinStockAlert(e.target.value)}
                placeholder="0"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                سعر التكلفة للوحدة (اختياري)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                سعر البيع للوحدة (اختياري)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">ملاحظات أو وصف الصنف (اختياري)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="وصف الصنف، مكان التخزين بالمستودع، ملاحظات الجودة، إلخ..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:border-emerald-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Edit Reason when editing an item (MANDATORY) */}
          {currentItem && (
            <div className={`p-4 rounded-xl border transition-all ${
              !editReason.trim()
                ? 'bg-amber-50/70 border-amber-300'
                : 'bg-emerald-50/50 border-emerald-300'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  سبب التعديل <span className="text-rose-600 font-extrabold">* (إلزامي لتوثيق سجل الرقابة)</span>
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  يشمل تعديلات: الاسم، حد التنبيه، القسم، الوصف، والأسعار
                </span>
              </div>
              <input
                type="text"
                required
                value={editReason}
                onChange={(e) => {
                  setEditReason(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                placeholder="اكتب سبب تعديل بيانات الصنف هنا (إلزامي)... مثال: تصحيح حد التنبيه / نقل لقسم جديد / تعديل الاسم التجاري"
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-2xs"
              />
              {!editReason.trim() ? (
                <p className="text-[11px] text-amber-800 font-bold mt-1.5 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>يجب إدخال سبب التعديل لحفظ التغييرات على هذا الصنف المسجل.</span>
                </p>
              ) : (
                <p className="text-[11px] text-emerald-700 font-medium mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>سيتم توثيق هذا السبب مع بياناتك وتاريخ التعديل في سجل الرقابة والتدقيق.</span>
                </p>
              )}
            </div>
          )}

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={
                !name.trim() ||
                !categoryId ||
                !baseUnitId ||
                isDuplicateName ||
                isDuplicateCode ||
                (currentItem !== null && !editReason.trim())
              }
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-md transition-all cursor-pointer"
            >
              {currentItem ? 'حفظ التعديلات' : 'إضافة الصنف'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
