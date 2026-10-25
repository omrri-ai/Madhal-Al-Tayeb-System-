import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  ArrowDownLeft,
  ArrowUpRight,
  AlertCircle,
  CheckCircle2,
  Calculator,
  ChevronDown,
  Package,
  Plus,
  Trash2,
  FileText,
  Boxes,
  Search,
} from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Item, MovementType, StockMovement } from '../../types/inventory';
import { ItemPickerBottomSheet } from '../common/ItemPickerBottomSheet';
import { canWithdraw } from '../../utils/stockRules';

interface StockMovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultType?: MovementType;
  preselectedItemId?: string;
  editingMovement?: StockMovement | null;
}

interface MovementRowItem {
  rowId: string;
  itemId: string;
  unitId: string;
  quantity: string;
  notes: string;
}

export const StockMovementModal: React.FC<StockMovementModalProps> = ({
  isOpen,
  onClose,
  defaultType = 'IN',
  preselectedItemId,
  editingMovement,
}) => {
  const { items, units, getItemStock, addMovement, updateMovement, updateItem, showToast } = useInventory();

  const activeItems = useMemo(
    () => items.filter((i) => !i.isDeleted && !i.isArchived),
    [items]
  );

  const [type, setType] = useState<MovementType>(defaultType);
  const [date, setDate] = useState<string>(new Date().toISOString().substring(0, 16));
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [generalNotes, setNotes] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // For multi-item rows when creating new movements
  const [rows, setRows] = useState<MovementRowItem[]>([]);
  const [activePickerRowId, setActivePickerRowId] = useState<string | null>(null);

  // For editing a single movement
  const [editItemId, setEditItemId] = useState<string>('');
  const [editUnitId, setEditUnitId] = useState<string>('');
  const [editQuantity, setEditQuantity] = useState<string>('1');

  // Initialize state when opening or switching mode
  useEffect(() => {
    if (!isOpen) return;

    setErrorMsg('');
    setIsSubmitting(false);

    if (editingMovement) {
      setType(editingMovement.type);
      setEditItemId(editingMovement.itemId);
      setEditUnitId(editingMovement.unitId);
      setEditQuantity(editingMovement.quantity.toString());
      setDate(
        editingMovement.date
          ? new Date(editingMovement.date).toISOString().substring(0, 16)
          : new Date().toISOString().substring(0, 16)
      );
      setReferenceNumber(editingMovement.referenceNumber || '');
      setNotes(editingMovement.notes || '');
    } else {
      setType(defaultType);
      const chosenItem = preselectedItemId || (activeItems.length > 0 ? activeItems[0].id : '');
      const foundItem = items.find((i) => i.id === chosenItem);
      const defaultUnit = foundItem?.baseUnitId || '';

      setRows([
        {
          rowId: 'row-1',
          itemId: chosenItem,
          unitId: defaultUnit,
          quantity: '1',
          notes: '',
        },
      ]);

      setDate(new Date().toISOString().substring(0, 16));
      setReferenceNumber('');
      setNotes('');
    }
  }, [isOpen, editingMovement, defaultType, preselectedItemId, activeItems, items]);

  // Helper to get available units and conversions for an item
  const getItemUnits = (item: Item | undefined) => {
    if (!item) return [];
    const list: { id: string; name: string; isBase: boolean; factor: number; label: string }[] = [];
    const baseU = units.find((u) => u.id === item.baseUnitId);
    if (baseU) {
      list.push({
        id: baseU.id,
        name: baseU.name,
        isBase: true,
        factor: 1,
        label: `${baseU.name} (الوحدة الأساسية)`,
      });
    }

    for (const conv of item.conversions || []) {
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
  };

  // Add a new row to multi-item builder
  const handleAddRow = () => {
    const nextItem = activeItems.find((i) => !rows.some((r) => r.itemId === i.id)) || activeItems[0];
    const defaultUnit = nextItem?.baseUnitId || '';
    setRows((prev) => [
      ...prev,
      {
        rowId: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        itemId: nextItem ? nextItem.id : '',
        unitId: defaultUnit,
        quantity: '1',
        notes: '',
      },
    ]);
  };

  // Remove a row
  const handleRemoveRow = (rowId: string) => {
    if (rows.length <= 1) {
      showToast('يجب أن يحتوي السند على صنف واحد على الأقل', 'error');
      return;
    }
    setRows((prev) => prev.filter((r) => r.rowId !== rowId));
  };

  // Update a row field
  const handleRowChange = (rowId: string, field: keyof MovementRowItem, value: any) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.rowId !== rowId) return r;
        if (field === 'itemId') {
          const newItem = items.find((i) => i.id === value);
          return {
            ...r,
            itemId: value,
            unitId: newItem?.baseUnitId || '',
          };
        }
        return { ...r, [field]: value };
      })
    );
    setErrorMsg('');
  };

  // Calculations for multi-item rows
  const rowsCalculations = useMemo(() => {
    return rows.map((r) => {
      const item = items.find((i) => i.id === r.itemId);
      const itemUnits = getItemUnits(item);
      const chosenUnit = itemUnits.find((u) => u.id === r.unitId) || itemUnits[0];
      const factor = chosenUnit?.factor || 1;
      const numQty = parseFloat(r.quantity) || 0;
      const baseQty = Math.round(numQty * factor * 1000) / 1000;
      const currentStock = item ? getItemStock(item.id) : 0;
      const baseUnitName = units.find((u) => u.id === item?.baseUnitId)?.name || 'وحدة';

      return {
        ...r,
        item,
        itemUnits,
        chosenUnit,
        factor,
        numQty,
        baseQty,
        currentStock,
        baseUnitName,
      };
    });
  }, [rows, items, units, getItemStock]);

  // Aggregate usage per item to detect if multi-rows exceed current stock
  const aggregatedStockValidation = useMemo(() => {
    if (type !== 'OUT') return { isValid: true, errors: [] as string[] };

    const usageByItem: Record<string, { name: string; totalRequestedBase: number; stock: number; baseUnitName: string }> = {};

    for (const r of rowsCalculations) {
      if (!r.item) continue;
      if (!usageByItem[r.item.id]) {
        usageByItem[r.item.id] = {
          name: r.item.name,
          totalRequestedBase: 0,
          stock: r.currentStock,
          baseUnitName: r.baseUnitName,
        };
      }
      usageByItem[r.item.id].totalRequestedBase += r.baseQty;
    }

    const errors: string[] = [];
    for (const [_, info] of Object.entries(usageByItem)) {
      if (!canWithdraw(info.stock, info.totalRequestedBase)) {
        errors.push(
          `الصنف "${info.name}": الكمية المطلوبة بالوحدة الأساسية (${info.totalRequestedBase} ${info.baseUnitName}) تتجاوز الرصيد المتوفر (${info.stock} ${info.baseUnitName})`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [rowsCalculations, type]);

  // Editing single item calculations
  const editItem = useMemo(() => items.find((i) => i.id === editItemId), [items, editItemId]);
  const editItemUnits = useMemo(() => getItemUnits(editItem), [editItem]);
  const editUnitInfo = useMemo(() => editItemUnits.find((u) => u.id === editUnitId) || editItemUnits[0], [editItemUnits, editUnitId]);
  const editFactor = editUnitInfo?.factor || 1;
  const editNumQty = parseFloat(editQuantity) || 0;
  const editBaseQty = Math.round(editNumQty * editFactor * 1000) / 1000;
  const editCurrentStock = editItem ? getItemStock(editItem.id) : 0;
  const editBaseUnitName = units.find((u) => u.id === editItem?.baseUnitId)?.name || 'وحدة';

  const editResultingStock = useMemo(() => {
    if (!editItem || !editingMovement) return 0;
    let base = editCurrentStock;
    if (editingMovement.type === 'IN') base -= editingMovement.baseQuantity;
    if (editingMovement.type === 'OUT') base += editingMovement.baseQuantity;
    if (type === 'IN') return base + editBaseQty;
    return base - editBaseQty;
  }, [editItem, editingMovement, editCurrentStock, type, editBaseQty]);

  const isEditInsufficient = type === 'OUT' && editingMovement && editResultingStock < 0;

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg('');

    // Handle single edit mode
    if (editingMovement) {
      if (!editItemId) {
        setErrorMsg('يرجى اختيار الصنف أولاً');
        return;
      }
      if (!editUnitId) {
        setErrorMsg('يرجى اختيار الوحدة');
        return;
      }
      if (editNumQty <= 0) {
        setErrorMsg('يرجى إدخال كمية صحيحة أكبر من الصفر');
        return;
      }
      if (isEditInsufficient) {
        setErrorMsg(
          `لا يمكن إتمام عملية الخروج: الرصيد بعد التعديل سيكون سالباً (${editResultingStock} ${editBaseUnitName}).`
        );
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await updateMovement(editingMovement.id, {
          unitId: editUnitId,
          quantity: editNumQty,
          type,
          date: new Date(date).toISOString(),
          referenceNumber,
          notes: generalNotes,
        });

        if (!res.success) {
          setErrorMsg(res.error || 'حدث خطأ أثناء تعديل الحركة');
          setIsSubmitting(false);
          return;
        }

        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'حدث خطأ غير متوقع');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Handle Multi-Item Creation Mode
    if (rows.length === 0) {
      setErrorMsg('يرجى إضافة صنف واحد على الأقل في السند');
      return;
    }

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!r.itemId) {
        setErrorMsg(`يرجى اختيار الصنف في السطر رقم (${i + 1})`);
        return;
      }
      if (!r.unitId) {
        setErrorMsg(`يرجى تحديد الوحدة للصنف في السطر رقم (${i + 1})`);
        return;
      }
      const qty = parseFloat(r.quantity) || 0;
      if (qty <= 0) {
        setErrorMsg(`يرجى إدخال كمية صحيحة أكبر من الصفر في السطر رقم (${i + 1})`);
        return;
      }
    }

    if (!aggregatedStockValidation.isValid) {
      setErrorMsg(aggregatedStockValidation.errors.join(' | '));
      return;
    }

    setIsSubmitting(true);

    try {
      const voucherRef =
        referenceNumber.trim() ||
        `${type === 'OUT' ? 'OUT' : 'IN'}-${Date.now().toString().slice(-6)}`;
      const isoDate = new Date(date).toISOString();

      let successCount = 0;
      for (const r of rows) {
        const calc = rowsCalculations.find((c) => c.rowId === r.rowId);
        const itemNote = r.notes.trim();
        const combinedNotes = [generalNotes.trim(), itemNote].filter(Boolean).join(' - ');

        const res = await addMovement({
          itemId: r.itemId,
          type,
          unitId: r.unitId,
          quantity: calc?.numQty || parseFloat(r.quantity),
          date: isoDate,
          referenceNumber: voucherRef,
          notes: combinedNotes,
        });

        if (!res.success) {
          setErrorMsg(res.error || `تعذر تسجيل الحركة للصنف (${calc?.item?.name || r.itemId})`);
          setIsSubmitting(false);
          return;
        }

        successCount++;
      }

      showToast(
        `تم تسجيل حركة ${type === 'IN' ? 'الوارد' : 'الصادر'} بنجاح (${successCount} أصناف) برقم مرجعي: ${voucherRef}`,
        'success'
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'حدث خطأ غير متوقع أثناء الحفظ');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 my-8 text-right max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-100 shrink-0">
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
                {editingMovement
                  ? 'تعديل حركة مخزنية'
                  : type === 'IN'
                  ? 'تسجيل وارد (دخول مخزون)'
                  : 'تسجيل صادر (خروج مخزون)'}
              </h3>
              <p className="text-xs text-slate-500">
                {editingMovement
                  ? 'تعديل بيانات الحركة المحددة'
                  : type === 'IN'
                  ? 'إضافة أصناف متعددة إلى الرصيد في سند وارد واحد'
                  : 'صرف وخروج أصناف متعددة من المخزون مع التحقق ومنع الرصيد السالب'}
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
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-700 text-sm shrink-0">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto pr-1 flex-1">
          {/* Movement Type Selector (Only if not editing) */}
          {!editingMovement && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">نوع الحركة المخزنية</label>
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
          )}

          {/* EDIT MODE: Single Item Form */}
          {editingMovement ? (
            <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">الصنف</label>
                <div className="p-3 bg-white border border-slate-200 rounded-xl text-right">
                  <div className="text-sm font-bold text-slate-900">{editItem?.name}</div>
                  <div className="text-xs text-slate-500 font-mono mt-0.5">{editItem?.code}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">الوحدة</label>
                  <select
                    value={editUnitId}
                    onChange={(e) => setEditUnitId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm"
                  >
                    {editItemUnits.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">الكمية</label>
                  <input
                    type="number"
                    step="any"
                    min="0.001"
                    value={editQuantity}
                    onChange={(e) => setEditQuantity(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold"
                  />
                </div>
              </div>

              <div className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 flex justify-between">
                <span>الرصيد بعد التعديل:</span>
                <span className={`font-bold font-mono ${editResultingStock < 0 ? 'text-rose-600' : 'text-emerald-700'}`}>
                  {editResultingStock} {editBaseUnitName}
                </span>
              </div>
            </div>
          ) : (
            /* CREATE MODE: Multi-Item Rows Builder */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Boxes className="w-4 h-4 text-slate-500" />
                  <span>أصناف السند ({rows.length})</span>
                </label>
                <span className="text-[11px] text-slate-500">
                  {type === 'OUT' ? 'يتم التحقق من رصيد كل صنف ومنع الرصيد السالب' : 'يتم إيداع الكميات للرصيد فوراً'}
                </span>
              </div>

              {/* Dynamic Rows */}
              <div className="space-y-3">
                {rowsCalculations.map((row, idx) => {
                  const isRowOutOfStock = type === 'OUT' && row.baseQty > row.currentStock;

                  return (
                    <div
                      key={row.rowId}
                      className={`p-3.5 rounded-2xl border transition-all ${
                        isRowOutOfStock
                          ? 'bg-rose-50/70 border-rose-300'
                          : 'bg-slate-50/90 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {/* Row Header */}
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold font-mono">
                            {idx + 1}
                          </span>
                          <span className="text-xs font-bold text-slate-700">الصنف والمواصفات</span>
                        </div>

                        {rows.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.rowId)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="حذف هذا الصنف من السند"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      {/* Item Selector */}
                      <div className="mb-2.5">
                        <button
                          type="button"
                          onClick={() => setActivePickerRowId(row.rowId)}
                          className="w-full text-right p-2.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-xl transition-all flex items-center justify-between gap-2 cursor-pointer shadow-2xs group"
                        >
                          {row.item ? (
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-700 truncate">
                                {row.item.name}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                                <span dir="ltr" className="font-mono">
                                  {row.item.code}
                                </span>
                                <span>•</span>
                                <span className={row.currentStock > 0 ? 'text-emerald-700 font-medium' : 'text-slate-500'}>
                                  المتوفر: {row.currentStock} {row.baseUnitName}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-slate-500 text-xs">
                              <Search className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>🔍 اضغط هنا للبحث واختيار الصنف...</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                              <Search className="w-3.5 h-3.5" />
                              <span>{row.item ? 'تغيير الصنف' : 'بحث واختيار'}</span>
                            </span>
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          </div>
                        </button>
                      </div>

                      {/* Unit & Quantity & Notes Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
                        {/* Unit */}
                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">الوحدة</label>
                          <select
                            value={row.unitId}
                            onChange={(e) => handleRowChange(row.rowId, 'unitId', e.target.value)}
                            disabled={row.itemUnits.length === 0}
                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:border-emerald-500"
                          >
                            {row.itemUnits.map((u) => (
                              <option key={u.id} value={u.id}>
                                {u.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Quantity */}
                        <div className="sm:col-span-4">
                          <label className="block text-[11px] font-semibold text-slate-600 mb-1">الكمية</label>
                          <input
                            type="number"
                            step="any"
                            min="0.001"
                            value={row.quantity}
                            onChange={(e) => handleRowChange(row.rowId, 'quantity', e.target.value)}
                            required
                            placeholder="الكمية"
                            className="w-full px-2.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:border-emerald-500"
                          />
                        </div>

                        {/* Base Quantity Preview */}
                        <div className="sm:col-span-3 flex flex-col justify-end">
                          <div className="px-2.5 py-2 bg-slate-100 rounded-xl text-[11px] text-slate-700 text-center font-medium">
                            <span className="block text-[10px] text-slate-500">بالأساسية:</span>
                            <span className="font-bold font-mono text-xs">
                              {row.baseQty} {row.baseUnitName}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Row Note (Optional) */}
                      <div className="mt-2">
                        <input
                          type="text"
                          value={row.notes}
                          onChange={(e) => handleRowChange(row.rowId, 'notes', e.target.value)}
                          placeholder="ملاحظة خاصة بهذا الصنف (اختياري)..."
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs placeholder:text-slate-400 focus:border-emerald-500"
                        />
                      </div>

                      {/* Stock Warning for Row */}
                      {isRowOutOfStock && (
                        <div className="mt-2 p-2 rounded-lg bg-rose-100 border border-rose-300 text-rose-800 text-xs flex items-center gap-1.5">
                          <AlertCircle className="w-4 h-4 shrink-0" />
                          <span>
                            تنبيه: الكمية المطلوبة ({row.baseQty} {row.baseUnitName}) تتجاوز الرصيد المتوفر ({row.currentStock} {row.baseUnitName})!
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Add Another Item Button */}
              <button
                type="button"
                onClick={handleAddRow}
                className="w-full py-3 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-800 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-2xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ إضافة صنف آخر للسند</span>
              </button>
            </div>
          )}

          {/* Date & Reference */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
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
                رقم السند / الفاتورة (اختياري)
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder={type === 'OUT' ? 'تلقائي: OUT-XXXXXX' : 'تلقائي: IN-XXXXXX'}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:border-emerald-500"
              />
            </div>
          </div>

          {/* General Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              بيان / ملاحظات عامة على السند (اختياري)
            </label>
            <textarea
              rows={2}
              value={generalNotes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="مثال: توريد من المورد س / إذن صرف للمستودع / بضاعة مستلمة..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:border-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (!editingMovement && type === 'OUT' && !aggregatedStockValidation.isValid)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-bold text-sm shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                type === 'IN'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : !aggregatedStockValidation.isValid
                  ? 'bg-rose-400 hover:bg-rose-500'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {type === 'IN' ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              <span>
                {isSubmitting
                  ? 'جاري الحفظ...'
                  : editingMovement
                  ? 'حفظ التعديلات'
                  : type === 'IN'
                  ? `تأكيد تسجيل الدخول (${rows.length} أصناف)`
                  : `تأكيد تسجيل الخروج (${rows.length} أصناف)`}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Item Picker Bottom Sheet for Dynamic Multi-Item Rows */}
      <ItemPickerBottomSheet
        isOpen={activePickerRowId !== null}
        onClose={() => setActivePickerRowId(null)}
        selectedItemId={
          (activePickerRowId
            ? rows.find((r) => r.rowId === activePickerRowId)?.itemId
            : '') || ''
        }
        onSelectItem={(chosenId) => {
          if (activePickerRowId) {
            handleRowChange(activePickerRowId, 'itemId', chosenId);
          }
          setActivePickerRowId(null);
        }}
        movementType={type}
        items={activeItems}
      />
    </div>
  );
};
