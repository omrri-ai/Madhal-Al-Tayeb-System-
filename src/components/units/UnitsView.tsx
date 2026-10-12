import React, { useState } from 'react';
import { Scale, Plus, Edit, Trash2, Sparkles, X, AlertCircle } from 'lucide-react';
import { useInventory } from '../../context/InventoryContext';
import { Unit } from '../../types/inventory';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const UnitsView: React.FC = () => {
  const { units, items, addUnit, updateUnit, deleteUnit, seedCommonUnits } = useInventory();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [description, setDescription] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Unit | null>(null);

  const handleOpenAdd = () => {
    setEditingUnit(null);
    setName('');
    setSymbol('');
    setDescription('');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (unit: Unit) => {
    setEditingUnit(unit);
    setName(unit.name);
    setSymbol(unit.symbol || '');
    setDescription(unit.description || '');
    setErrorMsg('');
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('يرجى إدخال اسم الوحدة');
      return;
    }

    if (editingUnit) {
      const res = updateUnit(editingUnit.id, name.trim(), symbol.trim(), description.trim());
      if (!res.success) {
        setErrorMsg(res.error || 'حدث خطأ أثناء التعديل');
        return;
      }
    } else {
      const res = addUnit(name.trim(), symbol.trim(), description.trim());
      if (!res.success) {
        setErrorMsg(res.error || 'حدث خطأ أثناء الإضافة');
        return;
      }
    }

    setIsModalOpen(false);
  };

  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    deleteUnit(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">الوحدات العامة للقياس والتعبئة</h3>
          <p className="text-xs text-slate-500 mt-1">
            إدارة الوحدات القابلة لإعادة الاستخدام (حبة، كرتون، درزن، شدة، كيلو...) واستخدامها كوحدة أساسية أو في تحويلات الأصناف
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Quick seed helper */}
          <button
            onClick={seedCommonUnits}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs transition-colors cursor-pointer"
            title="إضافة حزمة الوحدات الشائعة فوراً"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>إضافة الوحدات الشائعة</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة وحدة جديدة</span>
          </button>
        </div>
      </div>

      {/* Units Table */}
      {units.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
            <Scale className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 mb-1">لا توجد وحدات عامة مضافة بعد</h3>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            أضف وحدات القياس والتعبئة التي تستخدمها في مستودعك، أو اضغط زر "إضافة الوحدات الشائعة" لبدء سريع.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={seedCommonUnits}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4 text-amber-600" />
              <span>إضافة الوحدات الشائعة</span>
            </button>
            <button
              onClick={handleOpenAdd}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة وحدة يدوياً</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-4">اسم الوحدة</th>
                  <th className="py-3.5 px-4">الرمز / الاختصار</th>
                  <th className="py-3.5 px-4">الوصف والاستخدام</th>
                  <th className="py-3.5 px-4">استخدامات في الأصناف</th>
                  <th className="py-3.5 px-4 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {units.map((unit) => {
                  const usedAsBase = items.filter((i) => !i.isDeleted && i.baseUnitId === unit.id).length;
                  const usedInConv = items.filter(
                    (i) => !i.isDeleted && i.conversions.some((c) => c.unitId === unit.id)
                  ).length;

                  return (
                    <tr key={unit.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900">{unit.name}</span>
                          {unit.name === 'حبة' && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                              1 حبة
                            </span>
                          )}
                          {unit.name === 'درزن' && (
                            <span className="text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded-full font-bold font-mono">
                              12 حبة
                            </span>
                          )}
                          {unit.name === 'كرتون' && (
                            <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-medium">
                              سعة متغيرة (تُكتب لكل صنف)
                            </span>
                          )}
                          {(unit.name === 'كيلو' || unit.name === 'كيلوا') && (
                            <span className="text-[10px] bg-blue-50 text-blue-800 border border-blue-200 px-2 py-0.5 rounded-full font-bold font-mono">
                              1000 جرام
                            </span>
                          )}
                          {unit.name === 'جرام' && (
                            <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                              وحدة أساسية للوزن
                            </span>
                          )}
                          {unit.name === 'نص' && (
                            <span className="text-[10px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 rounded-full font-bold font-mono">
                              500 جرام (نصف كيلو)
                            </span>
                          )}
                          {unit.name === 'ربع' && (
                            <span className="text-[10px] bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 rounded-full font-bold font-mono">
                              250 جرام (ربع كيلو)
                            </span>
                          )}
                          {unit.name === 'ثمن' && (
                            <span className="text-[10px] bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded-full font-bold font-mono">
                              125 جرام (ثمن كيلو)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {unit.symbol || '-'}
                      </td>

                      <td className="py-3.5 px-4 text-xs text-slate-500">
                        {unit.description || '-'}
                      </td>

                      <td className="py-3.5 px-4 text-xs">
                        <div className="flex items-center gap-2">
                          {usedAsBase > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium text-[11px]">
                              {usedAsBase} كوحدة أساسية
                            </span>
                          )}
                          {usedInConv > 0 && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 font-medium text-[11px]">
                              {usedInConv} في التحويلات
                            </span>
                          )}
                          {usedAsBase === 0 && usedInConv === 0 && (
                            <span className="text-slate-400 text-[11px]">غير مستخدمة حالياً</span>
                          )}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handleOpenEdit(unit)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                            title="تعديل الوحدة"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(unit)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                            title="حذف الوحدة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Unit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 text-right">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">
                {editingUnit ? 'تعديل بيانات الوحدة' : 'إضافة وحدة جديدة'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  اسم الوحدة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: حبة، كرتون، درزن، شدة، كيلو..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  الرمز أو الاختصار (اختياري)
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="مثال: كغ، ح، در، كر..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm font-medium focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  الوصف (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="وصف استخدام هذه الوحدة..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-xs font-medium focus:bg-white focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer"
                >
                  {editingUnit ? 'حفظ التعديل' : 'إضافة الوحدة'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="حذف الوحدة العامة"
        message={`هل أنت متأكد من رغبتك في حذف الوحدة "${deleteTarget?.name}"؟`}
        confirmLabel="حذف الوحدة"
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
};
