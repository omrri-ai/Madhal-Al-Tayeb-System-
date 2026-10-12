/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { ReturnType, ReturnReason, ReturnStatus } from '../../types/inventory';
import { X, Plus, Trash2, ArrowDownLeft, ArrowUpRight, AlertTriangle } from 'lucide-react';

interface ReturnFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReturnFormModal: React.FC<ReturnFormModalProps> = ({ isOpen, onClose }) => {
  const { items, units, branches, addReturn, getItemStock, showToast } = useInventory();

  const [type, setType] = useState<ReturnType>('RETURN_IN');
  const [status, setStatus] = useState<ReturnStatus>('APPROVED'); // Default approved or draft
  const [destinationType, setDestinationType] = useState<'BRANCH' | 'CUSTOMER' | 'SUPPLIER'>('CUSTOMER');
  const [branchId, setBranchId] = useState('');
  const [partyName, setPartyName] = useState('');
  const [partyPhone, setPartyPhone] = useState('');
  const [originalReferenceNumber, setOriginalReferenceNumber] = useState('');
  const [reason, setReason] = useState<ReturnReason>('CUSTOMER_REQUEST');
  const [reasonDescription, setReasonDescription] = useState('');
  const [notes, setNotes] = useState('');

  // Items rows
  const [returnItems, setReturnItems] = useState<
    { itemId: string; unitId: string; quantity: number; notes: string }[]
  >([{ itemId: '', unitId: '', quantity: 1, notes: '' }]);

  if (!isOpen) return null;

  const activeItems = items.filter((i) => !i.isDeleted && !i.isArchived);

  const handleAddItemRow = () => {
    setReturnItems([...returnItems, { itemId: '', unitId: '', quantity: 1, notes: '' }]);
  };

  const handleRemoveItemRow = (index: number) => {
    if (returnItems.length === 1) return;
    setReturnItems(returnItems.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, itemId: string) => {
    const item = items.find((i) => i.id === itemId);
    const updated = [...returnItems];
    updated[index].itemId = itemId;
    if (item) {
      updated[index].unitId = item.baseUnitId; // Default to base unit
    }
    setReturnItems(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (returnItems.length === 0 || !returnItems[0].itemId) {
      showToast('يرجى اختيار صنف واحد على الأقل', 'error');
      return;
    }

    for (const row of returnItems) {
      if (!row.itemId) {
        showToast('يرجى تحديد جميع الأصناف', 'error');
        return;
      }
      if (!row.quantity || row.quantity <= 0) {
        showToast('يرجى إدخال كمية صحيحة أكبر من الصفر', 'error');
        return;
      }
    }

    const branch = branches.find((b) => b.id === branchId);

    const result = addReturn({
      type,
      status,
      date: new Date().toISOString(),
      destinationType,
      branchId: branchId || undefined,
      branchName: branch ? branch.name : undefined,
      partyName: partyName.trim() || undefined,
      partyPhone: partyPhone.trim() || undefined,
      originalReferenceNumber: originalReferenceNumber.trim() || undefined,
      reason,
      reasonDescription: reasonDescription.trim() || undefined,
      notes: notes.trim() || undefined,
      items: returnItems.map((r) => ({
        itemId: r.itemId,
        unitId: r.unitId,
        quantity: Number(r.quantity),
        notes: r.notes.trim() || undefined,
      })),
    });

    if (result.success) {
      onClose();
      // Reset form
      setPartyName('');
      setPartyPhone('');
      setOriginalReferenceNumber('');
      setReasonDescription('');
      setNotes('');
      setReturnItems([{ itemId: '', unitId: '', quantity: 1, notes: '' }]);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl">
              {type === 'RETURN_IN' ? (
                <ArrowDownLeft className="w-6 h-6 text-emerald-400" />
              ) : (
                <ArrowUpRight className="w-6 h-6 text-amber-400" />
              )}
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold">تسجيل عملية مرتجع جديدة</h2>
              <p className="text-xs text-slate-300">
                {type === 'RETURN_IN' ? 'مرتجع وارد إلى المستودع (يزيد الرصيد)' : 'مرتجع صادر من المستودع (ينقص الرصيد)'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Type Selector Tabs */}
          <div className="grid grid-cols-2 gap-3 p-1.5 bg-slate-100 rounded-2xl">
            <button
              type="button"
              onClick={() => setType('RETURN_IN')}
              className={`py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition ${
                type === 'RETURN_IN'
                  ? 'bg-white text-emerald-700 shadow-md font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
              مرتجع وارد (من عميل / فرع)
            </button>
            <button
              type="button"
              onClick={() => setType('RETURN_OUT')}
              className={`py-3 px-4 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition ${
                type === 'RETURN_OUT'
                  ? 'bg-white text-amber-700 shadow-md font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-4 h-4 text-amber-600" />
              مرتجع صادر (إلى مورد / جهة)
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Status */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">حالة العملية</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReturnStatus)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900 outline-none bg-white"
              >
                <option value="APPROVED">معتمدة (تؤثر على المخزون فوراً)</option>
                <option value="DRAFT">مسودة (لا تؤثر على المخزون حالياً)</option>
              </select>
            </div>

            {/* Destination / Party Type */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">جهة الارتباط</label>
              <select
                value={destinationType}
                onChange={(e) => setDestinationType(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900 outline-none bg-white"
              >
                {type === 'RETURN_IN' ? (
                  <>
                    <option value="CUSTOMER">عميل</option>
                    <option value="BRANCH">فرع داخلي</option>
                  </>
                ) : (
                  <>
                    <option value="SUPPLIER">مورد خارجي</option>
                    <option value="BRANCH">فرع</option>
                  </>
                )}
              </select>
            </div>

            {/* Branch if branch selected */}
            {destinationType === 'BRANCH' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">اختر الفرع المرتبط</label>
                <select
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900 outline-none bg-white"
                >
                  <option value="">-- اختر الفرع --</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} {b.city ? `(${b.city})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Party Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {type === 'RETURN_IN' ? 'اسم العميل / الجهة العائدة' : 'اسم المورد / الجهة المستلمة'}
              </label>
              <input
                type="text"
                value={partyName}
                onChange={(e) => setPartyName(e.target.value)}
                placeholder="أدخل اسم العميل أو المورد أو الجهة"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>

            {/* Party Phone */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">رقم الجوال (اختياري)</label>
              <input
                type="text"
                value={partyPhone}
                onChange={(e) => setPartyPhone(e.target.value)}
                placeholder="05xxxxxxxx"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>

            {/* Original Invoice Ref */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">رقم الفاتورة أو الحركة الأصلية</label>
              <input
                type="text"
                value={originalReferenceNumber}
                onChange={(e) => setOriginalReferenceNumber(e.target.value)}
                placeholder="مثال: INV-9821 أو رقم سند الصرف السابق"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
              />
            </div>

            {/* Return Reason */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">سبب المرتجع</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReturnReason)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900 outline-none bg-white"
              >
                <option value="DAMAGED">بضاعة تالفة / متضررة</option>
                <option value="DEFECTIVE">عيب صناعي</option>
                <option value="EXPIRED">منتهي الصلاحية</option>
                <option value="WRONG_ITEM">صنف غير مطلوب / خطأ في الطلب</option>
                <option value="SURPLUS">فائض عن الحاجة</option>
                <option value="CUSTOMER_REQUEST">رغبة العميل في الإرجاع</option>
                <option value="OTHER">سبب آخر</option>
              </select>
            </div>
          </div>

          {/* Reason description / Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">ملاحظات وتفاصيل إضافية</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="أي تفاصيل أخرى حول حالة البضاعة المرتجعة..."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-slate-900 outline-none"
            />
          </div>

          {/* Items Section */}
          <div className="border-t border-slate-200 pt-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">الأصناف المرتجعة</h3>
              <button
                type="button"
                onClick={handleAddItemRow}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-3 py-1.5 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                إضافة صنف آخر
              </button>
            </div>

            <div className="space-y-3">
              {returnItems.map((row, index) => {
                const selectedItem = items.find((i) => i.id === row.itemId);
                const availableStock = selectedItem ? getItemStock(selectedItem.id) : 0;
                const availableUnits = selectedItem
                  ? [
                      units.find((u) => u.id === selectedItem.baseUnitId),
                      ...selectedItem.conversions.map((c) => units.find((u) => u.id === c.unitId)),
                    ].filter(Boolean) as typeof units
                  : units;

                return (
                  <div key={index} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 relative space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                      {/* Item Selector */}
                      <div className="sm:col-span-6">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">الصنف</label>
                        <select
                          value={row.itemId}
                          onChange={(e) => handleItemChange(index, e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          <option value="">-- اختر الصنف --</option>
                          {activeItems.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.code} - {item.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity */}
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">الكمية</label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          value={row.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            const updated = [...returnItems];
                            updated[index].quantity = val;
                            setReturnItems(updated);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:ring-2 focus:ring-slate-900"
                        />
                      </div>

                      {/* Unit Selector */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-slate-600 mb-1">الوحدة</label>
                        <select
                          value={row.unitId}
                          onChange={(e) => {
                            const updated = [...returnItems];
                            updated[index].unitId = e.target.value;
                            setReturnItems(updated);
                          }}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white outline-none focus:ring-2 focus:ring-slate-900"
                        >
                          {availableUnits.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Delete Row Button */}
                      <div className="sm:col-span-1 flex items-end justify-end">
                        {returnItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(index)}
                            className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition mt-5"
                            title="حذف الصنف"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Stock note for RETURN_OUT */}
                    {selectedItem && type === 'RETURN_OUT' && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600 px-1">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>الرصيد المتاح في المستودع: <strong>{availableStock}</strong> وحدة أساسية</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20"
            >
              حفظ وتأكيد المرتجع
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
