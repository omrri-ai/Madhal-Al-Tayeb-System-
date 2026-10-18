import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  X,
  Plus,
  Trash2,
  FolderPlus,
  Scale,
  Sparkles,
  AlertCircle,
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

  const currentItem = useMemo(() => {
    if (!editingItem) return null;
    return items.find((i) => i.id === editingItem.id) || editingItem;
  }, [editingItem, items]);

  const hasMovements = useMemo(() => {
    if (!currentItem) return false;
    return movements.some((m) => m.itemId === currentItem.id);
  }, [currentItem, movements]);

  // Tab state: 'basic' or 'composite'
  const [activeTab, setActiveTab] = useState<'basic' | 'composite'>('basic');

  // Form Fields - Basic
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

  // Form Fields - Composite
  const [compositeName, setCompositeName] = useState('');
  const [components, setComponents] = useState<{ itemId: string; quantity: number }[]>([]);

  const [errorMsg, setErrorMsg] = useState('');

  // Inline Category Creator
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  // Inline Unit Creator
  const [showNewUnitInput, setShowNewUnitInput] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');

  // Duplicate checks
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

  const isDuplicateCompositeName = useMemo(() => {
    const clean = (compositeName || '').trim().toLowerCase();
    if (!clean) return false;
    if (currentItem && (currentItem.name || '').trim().toLowerCase() === clean) {
      return false;
    }
    return items.some(
      (i) => i.id !== currentItem?.id && !i.isDeleted && (i?.name || '').trim().toLowerCase() === clean
    );
  }, [compositeName, items, currentItem]);

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
      if (currentItem.isComposite) {
        setActiveTab('composite');
        setCompositeName(currentItem.name || '');
        setCategoryId(currentItem.categoryId || '');
        setComponents(currentItem.components ? JSON.parse(JSON.stringify(currentItem.components)) : []);
        setNotes(currentItem.notes || '');
      } else {
        setActiveTab('basic');
        setName(currentItem.name || '');
        setCode(currentItem.code || '');
        setCategoryId(currentItem.categoryId || '');
        setBaseUnitId(currentItem.baseUnitId || '');
        setConversions(currentItem.conversions ? JSON.parse(JSON.stringify(currentItem.conversions)) : []);
        setMinStockAlert(currentItem.minStockAlert != null ? String(currentItem.minStockAlert) : '0');
        setCostPrice(currentItem.costPrice != null ? String(currentItem.costPrice) : '');
        setSalePrice(currentItem.salePrice != null ? String(currentItem.salePrice) : '');
        setNotes(currentItem.notes || '');
      }
      setEditReason('');
      setErrorMsg('');
    } else {
      setActiveTab('basic');
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
      setCompositeName('');
      setComponents([]);
      setEditReason('');
      setErrorMsg('');
    }
    setShowNewCatInput(false);
    setShowNewUnitInput(false);
    setNewCatName('');
    setNewUnitName('');
  }, [isOpen, currentItem, categories, units, computeNextCode]);

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

  const availableConversionUnits = useMemo(() => {
    return units.filter((u) => u.id !== baseUnitId);
  }, [units, baseUnitId]);

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

  const handleCreateUnitInline = () => {
    if (!newUnitName.trim()) return;
    const res = addUnit(newUnitName.trim());
    if (res.success && res.unit) {
      if (!baseUnitId) {
        setBaseUnitId(res.unit.id);
      }
      setNewUnitName('');
      setShowNewUnitInput(false);
    } else {
      setErrorMsg(res.error || 'فشل إنشاء الوحدة');
    }
  };

  const getSuggestedFactor = (targetUnitId: string, currentBaseUnitId: string): number | '' => {
    const targetUnit = units.find((u) => u.id === targetUnitId)?.name.trim();
    const baseUnit = units.find((u) => u.id === currentBaseUnitId)?.name.trim();
    if (!targetUnit || !baseUnit) return '';

    if (targetUnit === 'كرتون') return '';
    if (targetUnit === 'درزن' && (baseUnit === 'حبة' || baseUnit === 'قطعة')) return 12;

    if (baseUnit === 'جرام' || baseUnit === 'غرام') {
      if (targetUnit === 'كيلو' || targetUnit === 'كيلوا') return 1000;
      if (targetUnit === 'نص') return 500;
      if (targetUnit === 'ربع') return 250;
      if (targetUnit === 'ثمن') return 125;
    }

    if (baseUnit === 'كيلو' || baseUnit === 'كيلوا') {
      if (targetUnit === 'نص') return 0.5;
      if (targetUnit === 'ربع') return 0.25;
      if (targetUnit === 'ثمن') return 0.125;
      if (targetUnit === 'جرام' || targetUnit === 'غرام') return 0.001;
    }

    return '';
  };

  const handleAddConversion = () => {
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

    if (activeTab === 'basic') {
      if (!name.trim()) {
        setErrorMsg('يرجى إدخال اسم الصنف الأساسي');
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

      const seen = new Set<string>();
      for (const c of conversions) {
        if (c.unitId === baseUnitId) {
          setErrorMsg('لا يمكن إضافة الوحدة الأساسية ضمن جدول التحويلات الإضافية');
          return;
        }
        if (seen.has(c.unitId)) {
          const uName = units.find((u) => u.id === c.unitId)?.name || 'الوحدة';
          setErrorMsg(`الوحدة (${uName}) مكررة في جدول التحويلات.`);
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
        isComposite: false,
        components: undefined,
      };

      if (currentItem) {
        const trimmedReason = editReason.trim();
        if (!trimmedReason) {
          setErrorMsg('كتابة سبب التعديل إلزامية لتوثيق تعديلات الصنف.');
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
    } else {
      // Composite Tab
      if (!compositeName.trim()) {
        setErrorMsg('يرجى إدخال اسم المنتج المركب الظاهر للعميل');
        return;
      }
      if (isDuplicateCompositeName) {
        setErrorMsg(`يوجد صنف مسجل مسبقاً بنفس الاسم "${compositeName.trim()}".`);
        return;
      }
      if (!categoryId) {
        setErrorMsg('يرجى اختيار القسم المناسب للمنتج المركب');
        return;
      }
      if (!components || components.length === 0 || components.some((c) => !c.itemId || c.quantity <= 0)) {
        setErrorMsg('يرجى إضافة مكون واحد على الأقل مع تحديد صنف صحيح وكمية أكبر من الصفر.');
        return;
      }

      const habbaUnit = units.find((u) => (u?.name || '').trim() === 'حبة') || units[0];

      const payload = {
        code: code.trim() || `ITM-${(items.length + 1).toString().padStart(4, '0')}`,
        name: compositeName.trim(),
        categoryId,
        baseUnitId: habbaUnit ? habbaUnit.id : '',
        conversions: [],
        minStockAlert: 0,
        notes: notes.trim(),
        isComposite: true,
        components: components.map((c) => ({ itemId: c.itemId, quantity: Number(c.quantity) })),
      };

      if (currentItem) {
        const trimmedReason = editReason.trim();
        if (!trimmedReason) {
          setErrorMsg('كتابة سبب التعديل إلزامية لتوثيق تعديلات المنتج المركب.');
          return;
        }
        const res = updateItem(currentItem.id, payload, trimmedReason);
        if (!res.success) {
          setErrorMsg(res.error || 'حدث خطأ أثناء تعديل المنتج المركب');
          return;
        }
      } else {
        const res = addItem(payload);
        if (!res.success) {
          setErrorMsg(res.error || 'حدث خطأ أثناء حفظ المنتج المركب');
          return;
        }
      }
    }

    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 my-8 text-right max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-3 border-b border-slate-100 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {currentItem ? 'تعديل بيانات الصنف' : 'إضافة صنف جديد'}
            </h3>
            <p className="text-xs text-slate-500">
              اختر نوع الصنف وقم بتعبئة البيانات المطلوبة بدقة
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

        {/* Segmented Control Tabs */}
        {!currentItem && (
          <div className="flex bg-slate-100 p-1 rounded-2xl mb-4 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'basic'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              صنف أساسي
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('composite')}
              className={`flex-1 py-2.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                activeTab === 'composite'
                  ? 'bg-white text-emerald-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              منتج مركب
            </button>
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-sm shrink-0">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto pr-1 pl-2 space-y-5">
            {activeTab === 'basic' ? (
              /* TAB 1: BASIC ITEM */
              <>
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
                      placeholder="مثال: بسكويت شاي / شاي كرك..."
                      className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-slate-900 text-sm font-medium focus:bg-white transition-colors ${
                        isDuplicateName
                          ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                          : 'border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200'
                      }`}
                    />
                    {isDuplicateName && (
                      <p className="text-[11px] text-rose-600 font-bold mt-1">
                        ⚠️ يوجد صنف مسجل مسبقاً بهذا الاسم.
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
                        placeholder="ITM-0001"
                        className={`flex-1 px-3.5 py-2.5 bg-slate-50 border rounded-xl text-slate-900 text-sm font-mono focus:bg-white ${
                          isDuplicateCode
                            ? 'border-rose-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-200'
                            : 'border-slate-200 focus:border-emerald-500'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setCode(computeNextCode())}
                        title="توليد الرمز التسلسلي"
                        className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors cursor-pointer"
                      >
                        <Sparkles className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Category Section */}
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
                      <span>{showNewCatInput ? 'إلغاء' : '+ إنشاء قسم'}</span>
                    </button>
                  </div>

                  {showNewCatInput && (
                    <div className="flex gap-2 mb-2 p-2.5 bg-white rounded-xl border border-emerald-300 shadow-xs">
                      <input
                        type="text"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        placeholder="اسم القسم الجديد..."
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white"
                      />
                      <button
                        type="button"
                        onClick={handleCreateCategoryInline}
                        disabled={!newCatName.trim()}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>حفظ</span>
                      </button>
                    </div>
                  )}

                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:border-emerald-500"
                  >
                    <option value="" disabled>-- اختر القسم --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Base Unit Section */}
                <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-800">
                        الوحدة الأساسية للصنف <span className="text-rose-500">*</span>
                      </label>
                      <p className="text-[11px] text-slate-500">أصغر وحدة للرصيد (مثل: حبة، كيلو)</p>
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

                  {!hasMovements && showNewUnitInput && (
                    <div className="flex gap-2 mb-2 p-2.5 bg-white rounded-xl border border-emerald-300 shadow-xs">
                      <input
                        type="text"
                        value={newUnitName}
                        onChange={(e) => setNewUnitName(e.target.value)}
                        placeholder="اسم الوحدة..."
                        className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                      />
                      <button
                        type="button"
                        onClick={handleCreateUnitInline}
                        disabled={!newUnitName.trim()}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>حفظ</span>
                      </button>
                    </div>
                  )}

                  <select
                    value={baseUnitId}
                    onChange={(e) => setBaseUnitId(e.target.value)}
                    disabled={hasMovements}
                    required
                    className={`w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium ${
                      hasMovements ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                    }`}
                  >
                    <option value="" disabled>-- اختر الوحدة الأساسية --</option>
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>

                {/* Conversions */}
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                      <Scale className="w-4 h-4 text-emerald-600" />
                      تحويلات الوحدات الإضافية
                    </h4>
                    <button
                      type="button"
                      onClick={handleAddConversion}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ تحويل</span>
                    </button>
                  </div>
                  {conversions.map((conv, index) => (
                    <div key={index} className="p-3 bg-white rounded-xl border border-emerald-100 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="font-bold">1</span>
                        <select
                          value={conv.unitId}
                          onChange={(e) => handleUpdateConversion(index, 'unitId', e.target.value)}
                          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold"
                        >
                          {availableConversionUnits.map((u) => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                        <span>=</span>
                        <input
                          type="number"
                          step="any"
                          min="0.001"
                          value={conv.factorToBase || ''}
                          onChange={(e) => handleUpdateConversion(index, 'factorToBase', e.target.value)}
                          className="w-28 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold"
                        />
                        <span className="font-bold text-emerald-800">{baseUnitName}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveConversion(index)}
                        className="text-rose-500 hover:text-rose-700 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Stock Alert & Pricing */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">حد التنبيه</label>
                    <input
                      type="number"
                      min="0"
                      value={minStockAlert}
                      onChange={(e) => setMinStockAlert(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">التكلفة</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">السعر</label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={salePrice}
                      onChange={(e) => setSalePrice(e.target.value)}
                      className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">ملاحظات</label>
                  <textarea
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                  />
                </div>
              </>
            ) : (
              /* TAB 2: COMPOSITE PRODUCT */
              <>
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200 space-y-4">
                  <div className="flex items-center gap-2 text-emerald-950 font-bold text-sm">
                    <Sparkles className="w-5 h-5 text-emerald-600" />
                    <span>إعداد و تعريف المنتج المركب</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      اسم المنتج المركب (الظاهر للعميل) <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={compositeName}
                      onChange={(e) => setCompositeName(e.target.value)}
                      placeholder="مثال: شنطة بيج ربع كيلو مركّبة..."
                      className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-slate-900 text-sm font-bold shadow-2xs ${
                        isDuplicateCompositeName ? 'border-rose-400' : 'border-slate-200 focus:border-emerald-500'
                      }`}
                    />
                    {isDuplicateCompositeName && (
                      <p className="text-[11px] text-rose-600 font-bold mt-1">
                        ⚠️ يوجد صنف مسجل مسبقاً بهذا الاسم.
                      </p>
                    )}
                  </div>

                  {/* Category Section for Composite */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        القسم <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowNewCatInput(!showNewCatInput)}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <FolderPlus className="w-3.5 h-3.5" />
                        <span>{showNewCatInput ? 'إلغاء' : '+ إنشاء قسم'}</span>
                      </button>
                    </div>

                    {showNewCatInput && (
                      <div className="flex gap-2 mb-2 p-2.5 bg-white rounded-xl border border-emerald-300 shadow-xs">
                        <input
                          type="text"
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          placeholder="اسم القسم الجديد..."
                          className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                        />
                        <button
                          type="button"
                          onClick={handleCreateCategoryInline}
                          disabled={!newCatName.trim()}
                          className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                        >
                          حفظ
                        </button>
                      </div>
                    )}

                    <select
                      value={categoryId}
                      onChange={(e) => setCategoryId(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:border-emerald-500"
                    >
                      <option value="" disabled>-- اختر القسم --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Components List */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold text-slate-800">مكونات المنتج (من الأصناف المسجلة مسبقاً)</h4>
                      <button
                        type="button"
                        onClick={() => setComponents([...components, { itemId: '', quantity: 1 }])}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ إضافة مكوّن</span>
                      </button>
                    </div>

                    <div className="space-y-2">
                      {components.map((comp, idx) => (
                        <div key={idx} className="flex gap-2 items-center bg-white p-2.5 rounded-xl border border-emerald-200 shadow-2xs">
                          <select
                            value={comp.itemId}
                            onChange={(e) => {
                              const newComps = [...components];
                              newComps[idx].itemId = e.target.value;
                              setComponents(newComps);
                            }}
                            className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium"
                          >
                            <option value="">-- اختر صنف من المخزون --</option>
                            {items.filter((i) => i.id !== currentItem?.id && !i.isDeleted && !i.isComposite).map((i) => (
                              <option key={i.id} value={i.id}>{i.name} ({i.code || '-'})</option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0.001"
                            step="any"
                            value={comp.quantity}
                            onChange={(e) => {
                              const newComps = [...components];
                              newComps[idx].quantity = parseFloat(e.target.value) || 0;
                              setComponents(newComps);
                            }}
                            className="w-24 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold"
                            placeholder="الكمية"
                          />
                          <button
                            type="button"
                            onClick={() => setComponents(components.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:text-rose-700 p-1.5 rounded-lg hover:bg-rose-50 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      {components.length === 0 && (
                        <div className="text-center py-6 px-4 bg-white rounded-xl border border-dashed border-emerald-300 text-slate-500 text-xs">
                          لا توجد مكونات مضافة. اضغط على "+ إضافة مكوّن" لاختيار المكونات.
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">ملاحظات (اختياري)</label>
                    <textarea
                      rows={2}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Edit Reason when editing an item (MANDATORY) */}
            {currentItem && (
              <div className="p-4 bg-amber-50/70 border border-amber-300 rounded-xl">
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  سبب التعديل <span className="text-rose-600">* (إلزامي للتوثيق)</span>
                </label>
                <input
                  type="text"
                  required
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="اكتب سبب التعديل هنا..."
                  className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-medium"
                />
              </div>
            )}
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={
                activeTab === 'basic'
                  ? (!name.trim() || !categoryId || !baseUnitId || isDuplicateName || isDuplicateCode || (currentItem !== null && !editReason.trim()))
                  : (!compositeName.trim() || !categoryId || components.length === 0 || isDuplicateCompositeName || (currentItem !== null && !editReason.trim()))
              }
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-md cursor-pointer"
            >
              {currentItem
                ? 'حفظ التعديلات'
                : activeTab === 'basic'
                ? 'إضافة الصنف'
                : 'حفظ المنتج المركب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
